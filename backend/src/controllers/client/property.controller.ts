import type { RequestHandler } from "express";

import { PERMISSIONS } from "../../lib/permissions";
import { HttpError } from "../../lib/http-error";
import { canBypassPropertyScope, hasPermission } from "../../lib/rbac";
import { prisma } from "../../lib/prisma";
import { getAuthenticatedUser } from "../../middleware/authenticate-client";
import { syncAuthenticatedUser } from "../../services/user-sync.service";
import {
  createPropertyForAuthenticatedUser,
  type CreatePropertyInput,
  type PropertyStatus,
} from "../../services/property.service";

type CreatePropertyRequestBody = {
  organizationId?: string;
  name?: string;
  code?: string | null;
  timezone?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  status?: string;
};

type AssignUserToPropertiesRequestBody = {
  organizationId?: string;
  userId?: string;
  propertyIds?: string[];
};

type UpdatePropertyAccessRequestBody = {
  roleId?: string | null;
};

type UpdatePropertySettingsRequestBody = {
  name?: string;
  timezone?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
};

type PropertyScopedRecord = {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  timezone: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string | null;
  status: string;
};

type DashboardEmployeeRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  employeeCode: string | null;
  employmentStatus: string;
};

type PropertyUserRoleRecord = {
  id: string;
  userId: string;
  roleId: string | null;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  role: {
    id: string;
    name: string;
  } | null;
};

type OrganizationRoleRecord = {
  id: string;
  name: string;
  description?: string | null;
  permissions: Array<{
    key: string;
  }>;
};

const operationalConfig = {
  overtimeHours: 40,
  autoClockOutHours: 12,
  schedulingEnabled: true,
} as const;

function isPropertyStatus(value: string | undefined): value is PropertyStatus {
  return value === "active" || value === "inactive" || value === "archived";
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeCountryCode(value: string | null | undefined): string | null {
  const normalizedValue = normalizeOptionalText(value);
  return normalizedValue ? normalizedValue.toUpperCase() : null;
}

function formatEmployeeName(employee: Pick<DashboardEmployeeRecord, "firstName" | "lastName">): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

function hashValue(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function seeded(seed: number, offset: number): number {
  const next = Math.sin(seed + offset * 97.13) * 10000;
  return next - Math.floor(next);
}

function seededInt(seed: number, offset: number, min: number, max: number): number {
  return Math.round(min + seeded(seed, offset) * (max - min));
}

function seededFloat(seed: number, offset: number, min: number, max: number, precision = 1): number {
  const raw = min + seeded(seed, offset) * (max - min);
  return Number(raw.toFixed(precision));
}

function formatHourLabel(hour: number): string {
  const normalizedHour = ((hour + 11) % 12) + 1;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${normalizedHour}:00 ${suffix}`;
}

function isOwnerRole(role: OrganizationRoleRecord | null): boolean {
  return Boolean(role?.permissions.some((permission) => permission.key === PERMISSIONS.ORG_MANAGE));
}

async function getPropertyOrThrow(propertyId: string): Promise<PropertyScopedRecord> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      code: true,
      timezone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      stateRegion: true,
      postalCode: true,
      countryCode: true,
      status: true,
    },
  });

  if (!property) {
    throw new HttpError(404, "Property not found.");
  }

  return property;
}

async function getAssignablePropertyRoles(organizationId: string): Promise<OrganizationRoleRecord[]> {
  return prisma.organizationRole.findMany({
    where: {
      organizationId,
      permissions: {
        none: {
          key: PERMISSIONS.ORG_MANAGE,
        },
      },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      permissions: {
        select: {
          key: true,
        },
      },
    },
  });
}

async function getPropertySwitcherOptions(userId: string, property: PropertyScopedRecord) {
  const bypass = await canBypassPropertyScope(userId, property.organizationId);

  if (bypass) {
    return prisma.property.findMany({
      where: {
        organizationId: property.organizationId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  const scopedProperties = await prisma.propertyUserRole.findMany({
    where: {
      userId,
      property: {
        organizationId: property.organizationId,
      },
    },
    orderBy: {
      property: {
        name: "asc",
      },
    },
    select: {
      property: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return scopedProperties.map((assignment) => assignment.property);
}

function createPropertyWorkforce(employees: DashboardEmployeeRecord[], propertyId: string) {
  return employees.map((employee, index) => {
    const seed = hashValue(`${propertyId}:${employee.id}:${index}`);
    const employmentIsActive = employee.employmentStatus.toLowerCase() === "active";
    const weeklyHours = employmentIsActive ? seededFloat(seed, 1, 24, 46) : 0;
    const todayHours = employmentIsActive ? seededFloat(seed, 2, 0, 9) : 0;
    const shiftStartHour = seededInt(seed, 3, 6, 13);
    const shiftDuration = seededInt(seed, 4, 6, 9);
    const shiftEndHour = Math.min(23, shiftStartHour + shiftDuration);
    const attendanceStatus = employmentIsActive
      ? todayHours > 4.5
        ? "clocked-in"
        : todayHours > 0
          ? "scheduled"
          : "off-shift"
      : "inactive";
    const overtimeHours = Math.max(0, Number((weeklyHours - operationalConfig.overtimeHours).toFixed(1)));

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      name: formatEmployeeName(employee),
      email: employee.email,
      phone: employee.phone,
      employmentStatus: employee.employmentStatus,
      attendanceStatus,
      todayHours,
      weeklyHours,
      overtimeHours,
      shiftLabel: `${formatHourLabel(shiftStartHour)} - ${formatHourLabel(shiftEndHour)}`,
      estimatedHourlyRate: seededFloat(seed, 5, 18, 32, 2),
    };
  });
}

function createPropertyOpenShifts(propertyId: string, workforce: ReturnType<typeof createPropertyWorkforce>) {
  const roleLabels = ["Front desk", "Housekeeping", "Maintenance", "Security"];
  const openShiftCount = Math.max(1, Math.min(3, Math.ceil((workforce.length || 1) / 2)));
  const seed = hashValue(`${propertyId}:open-shifts`);

  return Array.from({ length: openShiftCount }, (_, index) => {
    const startHour = seededInt(seed, index + 1, 7, 16);

    return {
      id: `open-${propertyId}-${index}`,
      role: roleLabels[index % roleLabels.length] ?? "Coverage",
      start: formatHourLabel(startHour),
      end: formatHourLabel(Math.min(23, startHour + 8)),
      status: index === 0 ? "urgent" : "open",
    };
  });
}

function createPropertySchedule(propertyId: string, workforce: ReturnType<typeof createPropertyWorkforce>) {
  const today = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    const shifts = workforce.slice(0, Math.min(workforce.length, 4)).map((employee, employeeIndex) => {
      const seed = hashValue(`${propertyId}:${employee.id}:schedule:${index}`);
      const startHour = seededInt(seed, employeeIndex + 1, 6, 14);
      const endHour = Math.min(23, startHour + seededInt(seed, employeeIndex + 2, 6, 8));

      return {
        id: `${employee.id}-${date.toISOString()}`,
        employeeId: employee.id,
        employeeName: employee.name,
        start: formatHourLabel(startHour),
        end: formatHourLabel(endHour),
        status: employee.attendanceStatus === "inactive" ? "unavailable" : "scheduled",
      };
    });

    return {
      id: date.toISOString(),
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      date: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      shifts,
    };
  });
}

export const createClientPropertyController: RequestHandler = async (req, res, next) => {
  try {
    const {
      organizationId,
      name,
      code,
      timezone,
      addressLine1,
      addressLine2,
      city,
      stateRegion,
      postalCode,
      countryCode,
      status,
    } = (req.body ?? {}) as CreatePropertyRequestBody;

    if (!organizationId?.trim()) {
      throw new HttpError(400, "organizationId is required.");
    }

    if (!name?.trim()) {
      throw new HttpError(400, "Property name is required.");
    }

    if (!timezone?.trim()) {
      throw new HttpError(400, "Property timezone is required.");
    }

    if (!isPropertyStatus(status)) {
      throw new HttpError(400, "Property status must be active, inactive, or archived.");
    }

    const authUser = getAuthenticatedUser(req);
    const property = await createPropertyForAuthenticatedUser(authUser, {
      organizationId,
      name,
      code: code ?? null,
      timezone,
      addressLine1: addressLine1 ?? null,
      addressLine2: addressLine2 ?? null,
      city: city ?? null,
      stateRegion: stateRegion ?? null,
      postalCode: postalCode ?? null,
      countryCode: countryCode ?? null,
      status,
    } satisfies CreatePropertyInput);

    res.status(201).json({ property });
  } catch (error) {
    next(error);
  }
};

export const getPropertyDashboardController: RequestHandler = async (req, res, next) => {
  try {
    const propertyId =
      typeof req.params.propertyId === "string" && req.params.propertyId.trim().length > 0
        ? req.params.propertyId.trim()
        : null;

    if (!propertyId) {
      throw new HttpError(400, "propertyId is required.");
    }

    const authUser = getAuthenticatedUser(req);
    const localUser = await syncAuthenticatedUser(authUser);
    const property = await getPropertyOrThrow(propertyId);

    const [propertyOptions, employeeAssignments, propertyUsers, availableRoles] = await Promise.all([
      getPropertySwitcherOptions(localUser.id, property),
      prisma.employeePropertyAssignment.findMany({
        where: {
          propertyId,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              employeeCode: true,
              employmentStatus: true,
            },
          },
        },
        orderBy: {
          employee: {
            firstName: "asc",
          },
        },
      }),
      prisma.propertyUserRole.findMany({
        where: {
          propertyId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          user: {
            email: "asc",
          },
        },
      }),
      getAssignablePropertyRoles(property.organizationId),
    ]);

    const workforce = createPropertyWorkforce(
      employeeAssignments.map((assignment) => assignment.employee),
      property.id
    );
    const openShifts = createPropertyOpenShifts(property.id, workforce);
    const scheduleDays = createPropertySchedule(property.id, workforce);
    const activeEmployees = workforce.filter((employee) => employee.attendanceStatus === "clocked-in").length;
    const hoursToday = Number(workforce.reduce((sum, employee) => sum + employee.todayHours, 0).toFixed(1));
    const overtimeHours = Number(
      workforce.reduce((sum, employee) => sum + employee.overtimeHours, 0).toFixed(1)
    );
    const estimatedWages = Number(
      workforce
        .reduce((sum, employee) => sum + employee.weeklyHours * employee.estimatedHourlyRate, 0)
        .toFixed(0)
    );

    res.json({
      dashboard: {
        property: {
          ...property,
          operationalConfig,
        },
        propertyOptions,
        overview: {
          activeEmployees,
          hoursToday,
          alerts: [
            {
              id: "missed-clock-outs",
              title: "Missed clock-outs",
              count: workforce.filter((employee) => employee.attendanceStatus === "clocked-in" && employee.todayHours > 8).length,
              severity: "warning",
            },
            {
              id: "overtime-warnings",
              title: "Overtime warnings",
              count: workforce.filter((employee) => employee.overtimeHours > 0).length,
              severity: "info",
            },
          ],
        },
        workforce,
        time: {
          timeline: workforce
            .filter((employee) => employee.attendanceStatus !== "inactive")
            .map((employee) => ({
              id: employee.id,
              employeeName: employee.name,
              status: employee.attendanceStatus,
              shiftLabel: employee.shiftLabel,
              todayHours: employee.todayHours,
            })),
          openShifts,
          weeklyHours: workforce.map((employee) => ({
            employeeId: employee.id,
            employeeName: employee.name,
            hours: employee.weeklyHours,
          })),
        },
        scheduling: {
          enabled: operationalConfig.schedulingEnabled,
          days: scheduleDays,
        },
        payroll: {
          totalHours: Number(workforce.reduce((sum, employee) => sum + employee.weeklyHours, 0).toFixed(1)),
          estimatedWages,
          overtimeHours,
        },
        access: {
          users: propertyUsers.map((propertyUser) => ({
            id: propertyUser.id,
            userId: propertyUser.userId,
            email: propertyUser.user.email,
            fullName: propertyUser.user.fullName,
            avatarUrl: propertyUser.user.avatarUrl,
            role: propertyUser.role,
          })),
          availableRoles: availableRoles.map((role) => ({
            id: role.id,
            name: role.name,
            description: role.description,
          })),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePropertyAccessController: RequestHandler = async (req, res, next) => {
  try {
    const propertyId =
      typeof req.params.propertyId === "string" && req.params.propertyId.trim().length > 0
        ? req.params.propertyId.trim()
        : null;
    const userId =
      typeof req.params.userId === "string" && req.params.userId.trim().length > 0 ? req.params.userId.trim() : null;
    const { roleId } = (req.body ?? {}) as UpdatePropertyAccessRequestBody;

    if (!propertyId) {
      throw new HttpError(400, "propertyId is required.");
    }

    if (!userId) {
      throw new HttpError(400, "userId is required.");
    }

    const authUser = getAuthenticatedUser(req);
    const localUser = await syncAuthenticatedUser(authUser);
    const property = await getPropertyOrThrow(propertyId);
    const canManageUsers = await hasPermission(localUser.id, property.organizationId, PERMISSIONS.USER_MANAGE);

    if (!canManageUsers) {
      throw new HttpError(403, "You do not have permission to manage property access.");
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: property.organizationId,
          userId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!membership || membership.status !== "active") {
      throw new HttpError(404, "The selected user is not an active member of this organization.");
    }

    if (roleId === null) {
      await prisma.propertyUserRole.deleteMany({
        where: {
          propertyId,
          userId,
        },
      });

      res.status(204).send();
      return;
    }

    if (!roleId?.trim()) {
      throw new HttpError(400, "roleId is required.");
    }

    const role = await prisma.organizationRole.findFirst({
      where: {
        id: roleId,
        organizationId: property.organizationId,
      },
      select: {
        id: true,
        name: true,
        permissions: {
          select: {
            key: true,
          },
        },
      },
    });

    if (!role) {
      throw new HttpError(404, "Role not found for this property.");
    }

    if (isOwnerRole(role)) {
      throw new HttpError(403, "Owner cannot be assigned as a property-scoped role.");
    }

    const assignment = await prisma.propertyUserRole.upsert({
      where: {
        propertyId_userId: {
          propertyId,
          userId,
        },
      },
      update: {
        roleId: role.id,
      },
      create: {
        propertyId,
        userId,
        roleId: role.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      assignment: {
        id: assignment.id,
        userId: assignment.userId,
        roleId: assignment.roleId,
        user: assignment.user,
        role: assignment.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePropertySettingsController: RequestHandler = async (req, res, next) => {
  try {
    const propertyId =
      typeof req.params.propertyId === "string" && req.params.propertyId.trim().length > 0
        ? req.params.propertyId.trim()
        : null;
    const body = (req.body ?? {}) as UpdatePropertySettingsRequestBody;

    if (!propertyId) {
      throw new HttpError(400, "propertyId is required.");
    }

    if (!body.name?.trim()) {
      throw new HttpError(400, "Property name is required.");
    }

    if (!body.timezone?.trim()) {
      throw new HttpError(400, "Property timezone is required.");
    }

    const property = await prisma.property.update({
      where: {
        id: propertyId,
      },
      data: {
        name: body.name.trim(),
        timezone: body.timezone.trim(),
        addressLine1: normalizeOptionalText(body.addressLine1),
        addressLine2: normalizeOptionalText(body.addressLine2),
        city: normalizeOptionalText(body.city),
        stateRegion: normalizeOptionalText(body.stateRegion),
        postalCode: normalizeOptionalText(body.postalCode),
        countryCode: normalizeCountryCode(body.countryCode),
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        code: true,
        timezone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        stateRegion: true,
        postalCode: true,
        countryCode: true,
        status: true,
      },
    });

    res.json({
      property: {
        ...property,
        operationalConfig,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const assignUserToPropertiesController: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthenticatedUser(req);
    await syncAuthenticatedUser(authUser);

    const { organizationId, userId, propertyIds } = (req.body ?? {}) as AssignUserToPropertiesRequestBody;

    if (!organizationId?.trim()) {
      throw new HttpError(400, "organizationId is required.");
    }

    if (!userId?.trim()) {
      throw new HttpError(400, "userId is required.");
    }

    if (!Array.isArray(propertyIds)) {
      throw new HttpError(400, "propertyIds must be an array.");
    }

    const uniquePropertyIds = Array.from(
      new Set(propertyIds.map((propertyId) => propertyId.trim()).filter((propertyId) => propertyId.length > 0))
    );

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      select: {
        roleId: true,
        status: true,
      },
    });

    if (!membership || membership.status !== "active") {
      throw new HttpError(404, "The target user is not an active member of this organization.");
    }

    const defaultPropertyRole = await prisma.organizationRole.findFirst({
      where: {
        organizationId,
        isDefault: true,
        permissions: {
          some: {
            key: PERMISSIONS.PROPERTY_READ,
          },
          none: {
            key: PERMISSIONS.ORG_MANAGE,
          },
        },
      },
      select: {
        id: true,
      },
    });

    const properties = uniquePropertyIds.length
      ? await prisma.property.findMany({
          where: {
            organizationId,
            id: {
              in: uniquePropertyIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : [];

    if (properties.length !== uniquePropertyIds.length) {
      throw new HttpError(404, "One or more properties were not found in this organization.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.propertyUserRole.deleteMany({
        where: {
          userId,
          property: {
            organizationId,
          },
          ...(uniquePropertyIds.length > 0
            ? {
                propertyId: {
                  notIn: uniquePropertyIds,
                },
              }
            : {}),
        },
      });

      for (const propertyId of uniquePropertyIds) {
        const existingAssignment = await tx.propertyUserRole.findUnique({
          where: {
            propertyId_userId: {
              propertyId,
              userId,
            },
          },
          select: {
            roleId: true,
          },
        });

        await tx.propertyUserRole.upsert({
          where: {
            propertyId_userId: {
              propertyId,
              userId,
            },
          },
          update: {
            roleId: existingAssignment?.roleId ?? defaultPropertyRole?.id ?? null,
          },
          create: {
            propertyId,
            userId,
            roleId: existingAssignment?.roleId ?? defaultPropertyRole?.id ?? null,
          },
        });
      }
    });

    const assignments = await prisma.propertyUserRole.findMany({
      where: {
        userId,
        property: {
          organizationId,
        },
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            organizationId: true,
          },
        },
      },
      orderBy: {
        property: {
          name: "asc",
        },
      },
    });

    res.json({
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        propertyId: assignment.propertyId,
        userId: assignment.userId,
        roleId: assignment.roleId,
        createdAt: assignment.createdAt.toISOString(),
        updatedAt: assignment.updatedAt.toISOString(),
        property: assignment.property,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const getUserAccessController: RequestHandler = async (req, res, next) => {
  try {
    const userId =
      typeof req.params.id === "string" && req.params.id.trim().length > 0 ? req.params.id.trim() : null;
    const organizationId =
      typeof req.query.organizationId === "string" && req.query.organizationId.trim().length > 0
        ? req.query.organizationId.trim()
        : null;

    if (!userId) {
      throw new HttpError(400, "userId is required.");
    }

    if (!organizationId) {
      throw new HttpError(400, "organizationId is required.");
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!membership) {
      throw new HttpError(404, "User access was not found for this organization.");
    }

    const assignedProperties = await prisma.propertyUserRole.findMany({
      where: {
        userId,
        property: {
          organizationId,
        },
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            organizationId: true,
          },
        },
      },
      orderBy: {
        property: {
          name: "asc",
        },
      },
    });

    res.json({
      access: {
        role: {
          id: membership.role.id,
          name: membership.role.name,
        },
        permissions: membership.role.permissions.map((permission) => permission.key).sort(),
        properties: assignedProperties.map((assignment) => assignment.property),
      },
    });
  } catch (error) {
    next(error);
  }
};
