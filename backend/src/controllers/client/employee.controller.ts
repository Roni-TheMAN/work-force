import type { RequestHandler } from "express";

import { canBypassPropertyScope, getOrganizationMembership } from "../../lib/rbac";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import { getAuthenticatedUser } from "../../middleware/authenticate-client";
import {
  normalizeEmployeePinMode,
  prepareEmployeePinAssignment,
  recordEmployeePinEvent,
  revealEmployeePin,
} from "../../services/employee-pin.service";
import { syncAuthenticatedUser } from "../../services/user-sync.service";

type AssignEmployeePropertyRequestBody = {
  propertyId?: string;
  roleId?: string | null;
  isPrimary?: boolean;
};

type UpdateEmployeePropertyRequestBody = {
  roleId?: string | null;
  isPrimary?: boolean;
};

type ResetEmployeePinRequestBody = {
  pinMode?: "auto" | "manual" | null;
  manualPin?: string | null;
};

type EmployeePropertyRoleSummary = {
  id: string;
  key: "manager" | "property_admin" | "scheduler" | "viewer";
  displayName: string;
};

type EmployeePropertyAssignmentSummary = {
  id: string;
  name: string;
  isPrimary: boolean;
  activeFrom: string | null;
  activeTo: string | null;
  role: EmployeePropertyRoleSummary | null;
};

type EmployeePinManagedRecord = {
  id: string;
  organizationId: string;
  pinCiphertext: string | null;
  pinLastSetAt: Date | null;
};

const EMPLOYEE_DELETE_BLOCKED_MESSAGE =
  "This employee has time, schedule, or payroll history and cannot be deleted. Archive the employee instead.";

function buildActiveAssignmentWhere(moment: Date) {
  return {
    OR: [{ activeFrom: null }, { activeFrom: { lte: moment } }],
    AND: [{ OR: [{ activeTo: null }, { activeTo: { gte: moment } }] }],
  };
}

function isAssignmentActiveAt(
  assignment: { activeFrom: Date | null; activeTo: Date | null },
  moment: Date
): boolean {
  return (!assignment.activeFrom || assignment.activeFrom <= moment) && (!assignment.activeTo || assignment.activeTo >= moment);
}

async function employeePropertyAssignmentHasHistory(employeeId: string, propertyId: string): Promise<boolean> {
  const [
    timePunches,
    shiftSessions,
    scheduleShifts,
    timeAdjustments,
    payrollSummaries,
    payrollSnapshots,
  ] = await Promise.all([
    prisma.timePunch.count({ where: { employeeId, propertyId } }),
    prisma.timeShiftSession.count({ where: { employeeId, propertyId } }),
    prisma.shift.count({ where: { employeeId, propertyId } }),
    prisma.timeAdjustment.count({ where: { employeeId, propertyId } }),
    prisma.payrollRunEmployeeSummary.count({
      where: {
        employeeId,
        payrollRun: {
          propertyId,
        },
      },
    }),
    prisma.payrollRunShiftSnapshot.count({
      where: {
        employeeId,
        payrollRun: {
          propertyId,
        },
      },
    }),
  ]);

  return [timePunches, shiftSessions, scheduleShifts, timeAdjustments, payrollSummaries, payrollSnapshots].some(
    (count) => count > 0
  );
}

async function employeeHasOperationalHistory(employeeId: string): Promise<boolean> {
  const [
    timePunches,
    shiftSessions,
    scheduleShifts,
    timeAdjustments,
    payrollSummaries,
    payrollSnapshots,
    pinEvents,
  ] = await Promise.all([
    prisma.timePunch.count({ where: { employeeId } }),
    prisma.timeShiftSession.count({ where: { employeeId } }),
    prisma.shift.count({ where: { employeeId } }),
    prisma.timeAdjustment.count({ where: { employeeId } }),
    prisma.payrollRunEmployeeSummary.count({ where: { employeeId } }),
    prisma.payrollRunShiftSnapshot.count({ where: { employeeId } }),
    prisma.employeePinEvent.count({ where: { employeeId } }),
  ]);

  return [timePunches, shiftSessions, scheduleShifts, timeAdjustments, payrollSummaries, payrollSnapshots, pinEvents].some(
    (count) => count > 0
  );
}

function readRequiredOrganizationId(req: Parameters<RequestHandler>[0]): string {
  const organizationId =
    typeof req.params.organizationId === "string" && req.params.organizationId.trim().length > 0
      ? req.params.organizationId.trim()
      : null;

  if (!organizationId) {
    throw new HttpError(400, "organizationId is required.");
  }

  return organizationId;
}

function readRequiredEmployeeId(req: Parameters<RequestHandler>[0]): string {
  const employeeId =
    typeof req.params.employeeId === "string" && req.params.employeeId.trim().length > 0
      ? req.params.employeeId.trim()
      : null;

  if (!employeeId) {
    throw new HttpError(400, "employeeId is required.");
  }

  return employeeId;
}

function readPropertyId(value: unknown, fieldName: string): string {
  const propertyId = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

  if (!propertyId) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  return propertyId;
}

function normalizePropertyRole(
  role: { id: string; name: string } | null | undefined
): EmployeePropertyRoleSummary | null {
  if (!role) {
    return null;
  }

  const normalizedRoleName = role.name.trim().toLowerCase();

  if (normalizedRoleName === "admin") {
    return {
      id: role.id,
      key: "property_admin",
      displayName: "Property admin",
    };
  }

  if (normalizedRoleName === "manager") {
    return {
      id: role.id,
      key: "manager",
      displayName: "Manager",
    };
  }

  if (normalizedRoleName === "scheduler") {
    return {
      id: role.id,
      key: "scheduler",
      displayName: "Scheduler",
    };
  }

  if (normalizedRoleName === "viewer") {
    return {
      id: role.id,
      key: "viewer",
      displayName: "Viewer",
    };
  }

  return null;
}

function getRoleRuleName(role: EmployeePropertyRoleSummary | null): string | null {
  return role?.key ?? null;
}

function ensureRoleCanBeAssignedByActor(
  actorCanBypassScope: boolean,
  role: EmployeePropertyRoleSummary | null
): void {
  if (actorCanBypassScope || !role) {
    return;
  }

  if (role.key !== "viewer" && role.key !== "scheduler") {
    throw new HttpError(403, "Managers can only assign viewer or scheduler property roles.");
  }
}

async function readActorContext(userId: string, organizationId: string) {
  const membership = await getOrganizationMembership(userId, organizationId);

  if (!membership || membership.status !== "active") {
    throw new HttpError(403, "You do not have access to that organization.");
  }

  const actorCanBypassScope = await canBypassPropertyScope(userId, organizationId);
  let scopedPropertyIds: string[] | null = null;

  if (!actorCanBypassScope) {
    const propertyAssignments = await prisma.propertyUserRole.findMany({
      where: {
        userId,
        property: {
          organizationId,
        },
      },
      select: {
        propertyId: true,
      },
    });

    scopedPropertyIds = propertyAssignments.map((assignment) => assignment.propertyId);
  }

  return {
    actorCanBypassScope,
    scopedPropertyIds,
  };
}

async function assertPropertyInOrganization(propertyId: string, organizationId: string) {
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      organizationId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!property) {
    throw new HttpError(404, "Property not found in this organization.");
  }

  return property;
}

function assertActorCanAccessProperty(
  actorCanBypassScope: boolean,
  scopedPropertyIds: string[] | null,
  propertyId: string
) {
  if (actorCanBypassScope) {
    return;
  }

  if (!scopedPropertyIds?.includes(propertyId)) {
    throw new HttpError(403, "You do not have access to that property.");
  }
}

async function assertEmployeeInOrganization(employeeId: string, organizationId: string) {
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      organizationId,
    },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!employee) {
    throw new HttpError(404, "Employee not found in this organization.");
  }

  return employee;
}

async function assertEmployeeForPinManagement(employeeId: string, organizationId: string): Promise<EmployeePinManagedRecord> {
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      organizationId,
    },
    select: {
      id: true,
      organizationId: true,
      pinCiphertext: true,
      pinLastSetAt: true,
    },
  });

  if (!employee) {
    throw new HttpError(404, "Employee not found in this organization.");
  }

  return employee;
}

function assertActorCanManageEmployeePins(actorCanBypassScope: boolean) {
  if (!actorCanBypassScope) {
    throw new HttpError(403, "Only organization owners and admins can manage employee kiosk PINs.");
  }
}

async function resolveAssignablePropertyRole(
  organizationId: string,
  roleId: string | null | undefined,
  actorCanBypassScope: boolean
): Promise<EmployeePropertyRoleSummary | null> {
  if (!roleId) {
    return null;
  }

  const role = await prisma.organizationRole.findFirst({
    where: {
      id: roleId,
      organizationId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  const normalizedRole = normalizePropertyRole(role);

  if (!normalizedRole) {
    throw new HttpError(404, "Role not found for this organization.");
  }

  ensureRoleCanBeAssignedByActor(actorCanBypassScope, normalizedRole);
  return normalizedRole;
}

async function findViewerRoleSummary(organizationId: string): Promise<EmployeePropertyRoleSummary | null> {
  const viewerRole = await prisma.organizationRole.findFirst({
    where: {
      organizationId,
      name: "Viewer",
    },
    select: {
      id: true,
      name: true,
    },
  });

  return normalizePropertyRole(viewerRole);
}

async function buildEmployeeResponse(
  organizationId: string,
  localUserId: string,
  propertyId?: string | null
) {
  const { actorCanBypassScope, scopedPropertyIds } = await readActorContext(localUserId, organizationId);

  if (propertyId) {
    await assertPropertyInOrganization(propertyId, organizationId);
    assertActorCanAccessProperty(actorCanBypassScope, scopedPropertyIds, propertyId);
  }

  const effectivePropertyIds = propertyId ? [propertyId] : scopedPropertyIds;
  const now = new Date();
  const activeAssignmentWhere = buildActiveAssignmentWhere(now);

  if (!actorCanBypassScope && !propertyId && effectivePropertyIds && effectivePropertyIds.length === 0) {
    return {
      employees: [],
      scope: {
        organizationId,
        propertyId: null,
      },
    };
  }

  const employees = await prisma.employee.findMany({
    where: {
      organizationId,
      ...(effectivePropertyIds
        ? {
            propertyAssignments: {
              some: {
                propertyId: {
                  in: effectivePropertyIds,
                },
                ...activeAssignmentWhere,
              },
            },
          }
        : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
      propertyAssignments: {
        where: effectivePropertyIds
          ? {
              propertyId: {
                in: effectivePropertyIds,
              },
            }
          : undefined,
        include: {
          property: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { property: { name: "asc" } }],
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const linkedUserIds = Array.from(
    new Set(employees.map((employee) => employee.userId).filter((value): value is string => Boolean(value)))
  );

  const propertyRoleAssignments =
    linkedUserIds.length > 0
      ? await prisma.propertyUserRole.findMany({
          where: {
            userId: {
              in: linkedUserIds,
            },
            property: {
              organizationId,
              ...(effectivePropertyIds
                ? {
                    id: {
                      in: effectivePropertyIds,
                    },
                  }
                : {}),
            },
          },
          include: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : [];

  const propertyRoleMap = new Map<string, EmployeePropertyRoleSummary | null>();

  for (const assignment of propertyRoleAssignments) {
    propertyRoleMap.set(
      `${assignment.userId}:${assignment.propertyId}`,
      normalizePropertyRole(assignment.role ? { id: assignment.role.id, name: assignment.role.name } : null)
    );
  }

  return {
    employees: employees.map((employee) => ({
      id: employee.id,
      organizationId: employee.organizationId,
      userId: employee.userId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      fullName: `${employee.firstName} ${employee.lastName}`.trim(),
      email: employee.email,
      phone: employee.phone,
      employeeCode: employee.employeeCode,
      employmentStatus: employee.employmentStatus,
      kioskPinConfigured: Boolean(employee.pinHash && employee.pinLookupKey && employee.pinCiphertext),
      kioskPinLastSetAt: employee.pinLastSetAt?.toISOString() ?? null,
      hasLogin: Boolean(employee.userId),
      user: employee.user,
      properties: employee.propertyAssignments.map((assignment): EmployeePropertyAssignmentSummary => ({
        id: assignment.property.id,
        name: assignment.property.name,
        isPrimary: assignment.isPrimary,
        activeFrom: assignment.activeFrom?.toISOString() ?? null,
        activeTo: assignment.activeTo?.toISOString() ?? null,
        role:
          employee.userId && propertyRoleMap.has(`${employee.userId}:${assignment.property.id}`)
            ? propertyRoleMap.get(`${employee.userId}:${assignment.property.id}`) ?? null
            : null,
      })),
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
    })),
    scope: {
      organizationId,
      propertyId: propertyId ?? null,
    },
  };
}

export const listClientEmployeesController: RequestHandler = async (req, res, next) => {
  try {
    const organizationId = readRequiredOrganizationId(req);
    const propertyId =
      typeof req.query.propertyId === "string" && req.query.propertyId.trim().length > 0
        ? req.query.propertyId.trim()
        : null;

    const authUser = getAuthenticatedUser(req);
    const localUser = await syncAuthenticatedUser(authUser);

    res.json(await buildEmployeeResponse(organizationId, localUser.id, propertyId));
  } catch (error) {
    next(error);
  }
};

export const addEmployeePropertyAssignmentController: RequestHandler = async (req, res, next) => {
  try {
    const organizationId = readRequiredOrganizationId(req);
    const employeeId = readRequiredEmployeeId(req);
    const { propertyId: rawPropertyId, roleId, isPrimary } = (req.body ?? {}) as AssignEmployeePropertyRequestBody;
    const propertyId = readPropertyId(rawPropertyId, "propertyId");

    const authUser = getAuthenticatedUser(req);
    const localUser = await syncAuthenticatedUser(authUser);
    const { actorCanBypassScope, scopedPropertyIds } = await readActorContext(localUser.id, organizationId);

    const [property, employee] = await Promise.all([
      assertPropertyInOrganization(propertyId, organizationId),
      assertEmployeeInOrganization(employeeId, organizationId),
    ]);
    assertActorCanAccessProperty(actorCanBypassScope, scopedPropertyIds, propertyId);

    const normalizedRole = await resolveAssignablePropertyRole(organizationId, roleId, actorCanBypassScope);
    const defaultViewerRole = employee.userId && !normalizedRole ? await findViewerRoleSummary(organizationId) : null;

    const assignment = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const existingAssignments = await tx.employeePropertyAssignment.findMany({
        where: {
          employeeId,
          ...buildActiveAssignmentWhere(now),
        },
        select: {
          propertyId: true,
          isPrimary: true,
        },
      });

      const shouldMakePrimary = Boolean(isPrimary) || existingAssignments.length === 0;

      if (shouldMakePrimary) {
        await tx.employeePropertyAssignment.updateMany({
          where: {
            employeeId,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      const nextAssignment = await tx.employeePropertyAssignment.upsert({
        where: {
          employeeId_propertyId: {
            employeeId,
            propertyId,
          },
        },
        update: {
          isPrimary: shouldMakePrimary,
          activeFrom: now,
          activeTo: null,
        },
        create: {
          employeeId,
          propertyId,
          isPrimary: shouldMakePrimary,
          activeFrom: now,
        },
      });

      if (employee.userId) {
        const nextRole = normalizedRole ?? defaultViewerRole;

        if (!nextRole) {
          throw new HttpError(500, "Viewer role is not configured for this organization.");
        }

        await tx.propertyUserRole.upsert({
          where: {
            propertyId_userId: {
              propertyId,
              userId: employee.userId,
            },
          },
          update: {
            roleId: nextRole.id,
          },
          create: {
            propertyId,
            userId: employee.userId,
            roleId: nextRole.id,
          },
        });
      }

      return nextAssignment;
    });

    res.status(201).json({
      assignment: {
        employeeId,
        property: {
          id: property.id,
          name: property.name,
        },
        isPrimary: assignment.isPrimary,
        role: normalizedRole ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmployeePropertyAssignmentController: RequestHandler = async (req, res, next) => {
  try {
    const organizationId = readRequiredOrganizationId(req);
    const employeeId = readRequiredEmployeeId(req);
    const propertyId = readPropertyId(req.params.propertyId, "propertyId");
    const { roleId, isPrimary } = (req.body ?? {}) as UpdateEmployeePropertyRequestBody;

    const authUser = getAuthenticatedUser(req);
    const localUser = await syncAuthenticatedUser(authUser);
    const { actorCanBypassScope, scopedPropertyIds } = await readActorContext(localUser.id, organizationId);

    assertActorCanAccessProperty(actorCanBypassScope, scopedPropertyIds, propertyId);

    const [employee, property, existingAssignment] = await Promise.all([
      assertEmployeeInOrganization(employeeId, organizationId),
      assertPropertyInOrganization(propertyId, organizationId),
      prisma.employeePropertyAssignment.findUnique({
        where: {
          employeeId_propertyId: {
            employeeId,
            propertyId,
          },
        },
        select: {
          employeeId: true,
          propertyId: true,
          isPrimary: true,
          activeFrom: true,
          activeTo: true,
        },
      }),
    ]);

    if (!existingAssignment) {
      throw new HttpError(404, "Employee is not assigned to that property.");
    }

    if (!isAssignmentActiveAt(existingAssignment, new Date())) {
      throw new HttpError(409, "This property assignment has ended. Re-add the employee to edit it.");
    }

    const normalizedRole = roleId ? await resolveAssignablePropertyRole(organizationId, roleId, actorCanBypassScope) : null;

    await prisma.$transaction(async (tx) => {
      if (isPrimary === true) {
        await tx.employeePropertyAssignment.updateMany({
          where: {
            employeeId,
            ...buildActiveAssignmentWhere(new Date()),
          },
          data: {
            isPrimary: false,
          },
        });
      }

      await tx.employeePropertyAssignment.update({
        where: {
          employeeId_propertyId: {
            employeeId,
            propertyId,
          },
        },
        data: {
          isPrimary: isPrimary === undefined ? existingAssignment.isPrimary : Boolean(isPrimary),
        },
      });

      if (employee.userId && normalizedRole) {
        await tx.propertyUserRole.upsert({
          where: {
            propertyId_userId: {
              propertyId,
              userId: employee.userId,
            },
          },
          update: {
            roleId: normalizedRole.id,
          },
          create: {
            propertyId,
            userId: employee.userId,
            roleId: normalizedRole.id,
          },
        });
      }
    });

    res.json({
      assignment: {
        employeeId,
        property: {
          id: property.id,
          name: property.name,
        },
        isPrimary: isPrimary === undefined ? existingAssignment.isPrimary : Boolean(isPrimary),
        role: normalizedRole,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const removeEmployeePropertyAssignmentController: RequestHandler = async (req, res, next) => {
  try {
    const organizationId = readRequiredOrganizationId(req);
    const employeeId = readRequiredEmployeeId(req);
    const propertyId = readPropertyId(req.params.propertyId, "propertyId");

    const authUser = getAuthenticatedUser(req);
    const localUser = await syncAuthenticatedUser(authUser);
    const { actorCanBypassScope, scopedPropertyIds } = await readActorContext(localUser.id, organizationId);

    assertActorCanAccessProperty(actorCanBypassScope, scopedPropertyIds, propertyId);

    const employee = await assertEmployeeInOrganization(employeeId, organizationId);
    const existingAssignment = await prisma.employeePropertyAssignment.findUnique({
      where: {
        employeeId_propertyId: {
          employeeId,
          propertyId,
        },
      },
      select: {
        employeeId: true,
        propertyId: true,
        isPrimary: true,
        activeFrom: true,
        activeTo: true,
      },
    });

    if (!existingAssignment) {
      throw new HttpError(404, "Employee is not assigned to that property.");
    }

    const hasHistory = await employeePropertyAssignmentHasHistory(employeeId, propertyId);
    const endedAt = new Date();
    const mode: "deleted" | "ended" = hasHistory ? "ended" : "deleted";
    const effectiveActiveTo =
      hasHistory && existingAssignment.activeTo && existingAssignment.activeTo < endedAt
        ? existingAssignment.activeTo
        : endedAt;

    await prisma.$transaction(async (tx) => {
      if (hasHistory) {
        await tx.employeePropertyAssignment.update({
          where: {
            employeeId_propertyId: {
              employeeId,
              propertyId,
            },
          },
          data: {
            activeTo: effectiveActiveTo,
            isPrimary: false,
          },
        });
      } else {
        await tx.employeePropertyAssignment.delete({
          where: {
            employeeId_propertyId: {
              employeeId,
              propertyId,
            },
          },
        });
      }

      if (employee.userId) {
        await tx.propertyUserRole.deleteMany({
          where: {
            propertyId,
            userId: employee.userId,
          },
        });
      }

      if (!existingAssignment.isPrimary) {
        return;
      }

      const nextAssignment = await tx.employeePropertyAssignment.findFirst({
        where: {
          employeeId,
          propertyId: {
            not: propertyId,
          },
          ...buildActiveAssignmentWhere(endedAt),
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          employeeId: true,
          propertyId: true,
        },
      });

      if (!nextAssignment) {
        return;
      }

      await tx.employeePropertyAssignment.update({
        where: {
          employeeId_propertyId: {
            employeeId: nextAssignment.employeeId,
            propertyId: nextAssignment.propertyId,
          },
        },
        data: {
          isPrimary: true,
        },
      });
    });

    res.json({
      mode,
      activeTo: mode === "ended" ? effectiveActiveTo.toISOString() : null,
    });
  } catch (error) {
    next(error);
  }
};

export const archiveEmployeeController: RequestHandler = async (req, res, next) => {
  try {
    const organizationId = readRequiredOrganizationId(req);
    const employeeId = readRequiredEmployeeId(req);
    const authUser = getAuthenticatedUser(req);
    const localUser = await syncAuthenticatedUser(authUser);
    await readActorContext(localUser.id, organizationId);

    const employee = await assertEmployeeInOrganization(employeeId, organizationId);
    const archivedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: {
          id: employee.id,
        },
        data: {
          employmentStatus: "archived",
          terminatedAt: archivedAt,
          pinHash: null,
          pinLookupKey: null,
          pinCiphertext: null,
          pinLastSetAt: null,
          pinLastSetByUserId: null,
        },
      });

      await tx.employeePropertyAssignment.updateMany({
        where: {
          employeeId: employee.id,
          OR: [{ activeTo: null }, { activeTo: { gt: archivedAt } }],
        },
        data: {
          activeTo: archivedAt,
          isPrimary: false,
        },
      });

      if (employee.userId) {
        await tx.propertyUserRole.deleteMany({
          where: {
            userId: employee.userId,
            property: {
              organizationId,
            },
          },
        });
      }
    });

    res.json({
      employee: {
        id: employee.id,
        employmentStatus: "archived",
        terminatedAt: archivedAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEmployeeController: RequestHandler = async (req, res, next) => {
  try {
    const organizationId = readRequiredOrganizationId(req);
    const employeeId = readRequiredEmployeeId(req);
    const authUser = getAuthenticatedUser(req);
    const localUser = await syncAuthenticatedUser(authUser);
    await readActorContext(localUser.id, organizationId);

    const employee = await assertEmployeeInOrganization(employeeId, organizationId);

    if (await employeeHasOperationalHistory(employee.id)) {
      throw new HttpError(409, EMPLOYEE_DELETE_BLOCKED_MESSAGE);
    }

    await prisma.$transaction(async (tx) => {
      if (employee.userId) {
        await tx.propertyUserRole.deleteMany({
          where: {
            userId: employee.userId,
            property: {
              organizationId,
            },
          },
        });
      }

      await tx.employee.delete({
        where: {
          id: employee.id,
        },
      });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const revealEmployeePinController: RequestHandler = async (req, res, next) => {
  try {
    const organizationId = readRequiredOrganizationId(req);
    const employeeId = readRequiredEmployeeId(req);
    const authUser = getAuthenticatedUser(req);
    const localUser = await syncAuthenticatedUser(authUser);
    const { actorCanBypassScope } = await readActorContext(localUser.id, organizationId);

    assertActorCanManageEmployeePins(actorCanBypassScope);

    const employee = await assertEmployeeForPinManagement(employeeId, organizationId);
    const pin = revealEmployeePin(organizationId, employee.pinCiphertext);

    await recordEmployeePinEvent(prisma, {
      organizationId,
      employeeId: employee.id,
      performedByUserId: localUser.id,
      eventType: "revealed",
    });

    res.json({
      pinReveal: {
        value: pin,
        assignedAt: employee.pinLastSetAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resetEmployeePinController: RequestHandler = async (req, res, next) => {
  try {
    const organizationId = readRequiredOrganizationId(req);
    const employeeId = readRequiredEmployeeId(req);
    const body = (req.body ?? {}) as ResetEmployeePinRequestBody;
    const authUser = getAuthenticatedUser(req);
    const localUser = await syncAuthenticatedUser(authUser);
    const { actorCanBypassScope } = await readActorContext(localUser.id, organizationId);
    const pinMode = normalizeEmployeePinMode(body.pinMode);

    assertActorCanManageEmployeePins(actorCanBypassScope);

    const employee = await assertEmployeeForPinManagement(employeeId, organizationId);
    const result = await prisma.$transaction(async (tx) => {
      const pinAssignment = await prepareEmployeePinAssignment(tx, {
        organizationId,
        pinMode,
        manualPin: body.manualPin ?? null,
        excludeEmployeeId: employee.id,
      });

      await tx.employee.update({
        where: {
          id: employee.id,
        },
        data: {
          pinHash: pinAssignment.pinHash,
          pinLookupKey: pinAssignment.pinLookupKey,
          pinCiphertext: pinAssignment.pinCiphertext,
          pinLastSetAt: pinAssignment.assignedAt,
          pinLastSetByUserId: localUser.id,
        },
      });

      await recordEmployeePinEvent(tx, {
        organizationId,
        employeeId: employee.id,
        performedByUserId: localUser.id,
        eventType: "reset",
        pinMode,
      });

      return pinAssignment;
    });

    res.json({
      pinReveal: {
        value: result.plainTextPin,
        mode: result.pinMode,
        assignedAt: result.assignedAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
