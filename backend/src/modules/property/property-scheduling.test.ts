import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSIONS } from "../../lib/permissions";
import type { PropertyRequestContext } from "./property.middleware";
import {
  applyPropertyScheduleTemplate,
  createPropertyShift,
  createPropertyScheduleTemplate,
  deletePropertyShift,
  deletePropertyScheduleTemplate,
  getOrganizationSchedulingSummary,
  getPropertyScheduleWeek,
  listPropertyScheduleTemplates,
  publishPropertySchedule,
  updatePropertyScheduleTemplate,
  updatePropertyShift,
} from "./property-scheduling";

type ScheduleRow = {
  createdAt: Date;
  id: string;
  organizationId: string;
  propertyId: string;
  publishedAt: Date | null;
  publishedByUserId: string | null;
  status: string;
  updatedAt: Date;
  weekStartDate: Date;
};

type ShiftRow = {
  breakMinutes: number;
  createdAt: Date;
  createdByUserId: string;
  date: Date;
  employeeId: string | null;
  endAt: Date;
  id: string;
  notes: string | null;
  organizationId: string;
  positionLabel: string | null;
  propertyId: string;
  scheduleId: string;
  startAt: Date;
  status: string;
  updatedAt: Date;
  updatedByUserId: string;
};

type ScheduleTemplateRow = {
  createdAt: Date;
  createdByUserId: string;
  id: string;
  name: string;
  organizationId: string;
  propertyId: string;
  slotIndex: number;
  updatedAt: Date;
  updatedByUserId: string;
};

type ScheduleTemplateShiftRow = {
  breakMinutes: number;
  createdAt: Date;
  dayIndex: number;
  employeeId: string | null;
  endMinutes: number;
  id: string;
  isOvernight: boolean;
  notes: string | null;
  organizationId: string;
  positionLabel: string | null;
  propertyId: string;
  startMinutes: number;
  status: string;
  templateId: string;
  updatedAt: Date;
};

type EmployeeRow = {
  employmentStatus: string;
  firstName: string;
  id: string;
  lastName: string;
  organizationId: string;
  terminatedAt: Date | null;
};

type AssignmentRow = {
  activeFrom: Date | null;
  activeTo: Date | null;
  employeeId: string;
  propertyId: string;
};

type PayRateRow = {
  effectiveFrom: Date;
  effectiveTo: Date | null;
  employeeId: string;
  organizationId: string;
  propertyId: string | null;
  title: string | null;
};

type UserRow = {
  email: string | null;
  fullName: string | null;
  id: string;
};

type PropertyRow = {
  id: string;
  name: string;
  organizationId: string;
  timezone: string;
};

type MembershipRow = {
  organizationId: string;
  permissions: string[];
  status: string;
  userId: string;
};

type PropertyAccessRow = {
  propertyId: string;
  userId: string;
};

function createContext(overrides?: {
  organizationId?: string;
  permissionKeys?: string[];
  propertyId?: string;
  propertyName?: string;
  timezone?: string;
}) {
  const organizationId = overrides?.organizationId ?? "org-1";
  const propertyId = overrides?.propertyId ?? "property-1";
  const permissionKeys = overrides?.permissionKeys ?? [PERMISSIONS.SCHEDULE_READ, PERMISSIONS.SCHEDULE_WRITE];

  return {
    authUser: {
      avatarUrl: null,
      email: "manager@example.com",
      fullName: "Manager Example",
      id: "auth-user-1",
      phone: null,
      role: null,
      token: "token",
    },
    localUser: {
      avatarUrl: null,
      createdAt: "2026-04-20T09:00:00.000Z",
      email: "manager@example.com",
      fullName: "Manager Example",
      id: "user-1",
      lastActiveOrganizationId: organizationId,
      phone: null,
      updatedAt: "2026-04-20T09:00:00.000Z",
    },
    organizationMembership: {
      id: "membership-1",
      organizationId,
      role: {
        id: "role-1",
        name: "Manager",
        permissions: permissionKeys.map((key) => ({ key })),
      },
      status: "active",
      userId: "user-1",
    },
    permissions: {
      canBypassPropertyScope: false,
      effective: permissionKeys,
      organization: permissionKeys,
      property: permissionKeys,
    },
    property: {
      addressLine1: null,
      addressLine2: null,
      city: null,
      code: "PROP-1",
      countryCode: null,
      id: propertyId,
      name: overrides?.propertyName ?? "Downtown Hotel",
      organizationId,
      postalCode: null,
      stateRegion: null,
      status: "active",
      timezone: overrides?.timezone ?? "America/Indianapolis",
    },
    propertyUserRole: {
      id: "property-role-1",
      role: {
        id: "property-role-definition-1",
        name: "Scheduler",
        permissions: permissionKeys.map((key) => ({ key })),
      },
    },
  } satisfies PropertyRequestContext;
}

function createFakeSchedulingDb(seed?: {
  assignments?: AssignmentRow[];
  employees?: EmployeeRow[];
  memberships?: MembershipRow[];
  now?: Date;
  payRates?: PayRateRow[];
  properties?: PropertyRow[];
  propertyAccess?: PropertyAccessRow[];
  schedules?: ScheduleRow[];
  scheduleTemplateShifts?: ScheduleTemplateShiftRow[];
  scheduleTemplates?: ScheduleTemplateRow[];
  shifts?: ShiftRow[];
  users?: UserRow[];
  weekStartsOnByProperty?: Record<string, number | null>;
}) {
  const now = seed?.now ?? new Date("2026-04-23T15:00:00.000Z");
  const schedules = [...(seed?.schedules ?? [])];
  const scheduleTemplates = [...(seed?.scheduleTemplates ?? [])];
  const scheduleTemplateShifts = [...(seed?.scheduleTemplateShifts ?? [])];
  const shifts = [...(seed?.shifts ?? [])];
  const employees = [...(seed?.employees ?? [])];
  const assignments = [...(seed?.assignments ?? [])];
  const payRates = [...(seed?.payRates ?? [])];
  const users = [...(seed?.users ?? [{ email: "manager@example.com", fullName: "Manager Example", id: "user-1" }])];
  const memberships = [...(seed?.memberships ?? [])];
  const properties =
    seed?.properties ??
    [
      {
        id: "property-1",
        name: "Downtown Hotel",
        organizationId: "org-1",
        timezone: "America/Indianapolis",
      },
      {
        id: "property-2",
        name: "Airport Suites",
        organizationId: "org-1",
        timezone: "America/Chicago",
      },
    ];
  const propertyAccess = [...(seed?.propertyAccess ?? [])];
  const weekStartsOnByProperty = seed?.weekStartsOnByProperty ?? {};
  let scheduleCounter = schedules.length + 1;
  let scheduleTemplateCounter = scheduleTemplates.length + 1;
  let scheduleTemplateShiftCounter = scheduleTemplateShifts.length + 1;
  let shiftCounter = shifts.length + 1;

  function formatDateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  function findScheduleByComposite(propertyId: string, weekStartDate: Date) {
    const targetDate = formatDateOnly(weekStartDate);
    return schedules.find(
      (schedule) => schedule.propertyId === propertyId && formatDateOnly(schedule.weekStartDate) === targetDate
    );
  }

  function buildPublishedByUser(userId: string | null) {
    return users.find((user) => user.id === userId) ?? null;
  }

  function buildTemplateShiftWithRelations(shift: ScheduleTemplateShiftRow) {
    const employee = shift.employeeId ? employees.find((entry) => entry.id === shift.employeeId) ?? null : null;

    return {
      ...shift,
      employee,
    };
  }

  function buildTemplateRecordWithRelations(template: ScheduleTemplateRow) {
    return {
      ...template,
      shifts: scheduleTemplateShifts
        .filter((shift) => shift.templateId === template.id)
        .sort((left, right) => {
          if (left.dayIndex !== right.dayIndex) {
            return left.dayIndex - right.dayIndex;
          }

          if (left.startMinutes !== right.startMinutes) {
            return left.startMinutes - right.startMinutes;
          }

          return left.createdAt.getTime() - right.createdAt.getTime();
        })
        .map((shift) => buildTemplateShiftWithRelations(shift)),
    };
  }

  const db = {
    $transaction: async <T>(callback: (tx: unknown) => Promise<T>) => callback(db),
    employee: {
      findFirst: async (args: {
        where: {
          id: string;
          organizationId: string;
        };
      }) =>
        employees.find(
          (employee) =>
            employee.id === args.where.id && employee.organizationId === args.where.organizationId
        ) ?? null,
    },
    employeePayRate: {
      findFirst: async (args: {
        orderBy?: {
          effectiveFrom: "desc" | "asc";
        };
        where: {
          employeeId: string;
          organizationId: string;
          propertyId: string | null;
          effectiveFrom: {
            lte: Date;
          };
          OR: Array<{
            effectiveTo: null | {
              gte: Date;
            };
          }>;
        };
      }) => {
        const matches = payRates
          .filter(
            (rate) =>
              rate.employeeId === args.where.employeeId &&
              rate.organizationId === args.where.organizationId &&
              rate.propertyId === args.where.propertyId &&
              rate.effectiveFrom.getTime() <= args.where.effectiveFrom.lte.getTime() &&
              (!rate.effectiveTo || rate.effectiveTo.getTime() >= args.where.effectiveFrom.lte.getTime())
          )
          .sort((left, right) => right.effectiveFrom.getTime() - left.effectiveFrom.getTime());

        return matches[0] ?? null;
      },
    },
    employeePropertyAssignment: {
      findUnique: async (args: {
        where: {
          employeeId_propertyId: {
            employeeId: string;
            propertyId: string;
          };
        };
      }) =>
        assignments.find(
          (assignment) =>
            assignment.employeeId === args.where.employeeId_propertyId.employeeId &&
            assignment.propertyId === args.where.employeeId_propertyId.propertyId
        ) ?? null,
    },
    organizationMember: {
      findUnique: async (args: {
        include?: {
          role: {
            include: {
              permissions: true;
            };
          };
        };
        where: {
          organizationId_userId: {
            organizationId: string;
            userId: string;
          };
        };
      }) => {
        const membership = memberships.find(
          (entry) =>
            entry.organizationId === args.where.organizationId_userId.organizationId &&
            entry.userId === args.where.organizationId_userId.userId
        );

        if (!membership) {
          return null;
        }

        return {
          organizationId: membership.organizationId,
          role: {
            permissions: membership.permissions.map((key) => ({ key })),
          },
          status: membership.status,
          userId: membership.userId,
        };
      },
    },
    property: {
      findMany: async (args: {
        orderBy?: {
          name: "asc" | "desc";
        };
        select: {
          id: true;
          name: true;
          payrollSettings: true;
          timezone: true;
        };
        where: {
          organizationId: string;
          userRoles?: {
            some: {
              userId: string;
            };
          };
        };
      }) =>
        properties
          .filter((property) => property.organizationId === args.where.organizationId)
          .filter((property) =>
            args.where.userRoles
              ? propertyAccess.some(
                  (entry) => entry.propertyId === property.id && entry.userId === args.where.userRoles?.some.userId
                )
              : true
          )
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((property) => ({
            id: property.id,
            name: property.name,
            payrollSettings:
              weekStartsOnByProperty[property.id] === undefined
                ? []
                : [
                    {
                      payrollCalendar: {
                        weekStartsOn: weekStartsOnByProperty[property.id],
                      },
                    },
                  ],
            timezone: property.timezone,
          })),
    },
    propertyPayrollSetting: {
      findFirst: async (args: {
        where: {
          propertyId: string;
        };
      }) => {
        if (!(args.where.propertyId in weekStartsOnByProperty)) {
          return null;
        }

        return {
          payrollCalendar: {
            weekStartsOn: weekStartsOnByProperty[args.where.propertyId],
          },
        };
      },
    },
    schedule: {
      findMany: async (args: {
        select: {
          _count: {
            select: {
              shifts: true;
            };
          };
          propertyId: true;
          publishedAt: true;
          status: true;
          weekStartDate: true;
        };
        where: {
          OR: Array<{
            propertyId: string;
            weekStartDate: Date;
          }>;
          organizationId: string;
        };
      }) =>
        schedules
          .filter((schedule) => schedule.organizationId === args.where.organizationId)
          .filter((schedule) =>
            args.where.OR.some(
              (entry) =>
                entry.propertyId === schedule.propertyId &&
                formatDateOnly(entry.weekStartDate) === formatDateOnly(schedule.weekStartDate)
            )
          )
          .map((schedule) => ({
            _count: {
              shifts: shifts.filter((shift) => shift.scheduleId === schedule.id).length,
            },
            propertyId: schedule.propertyId,
            publishedAt: schedule.publishedAt,
            status: schedule.status,
            weekStartDate: schedule.weekStartDate,
          })),
      findUnique: async (args: {
        select: {
          createdAt: true;
          id: true;
          propertyId: true;
          publishedAt: true;
          publishedByUser: true;
          publishedByUserId: true;
          status: true;
          updatedAt: true;
          weekStartDate: true;
        };
        where: {
          propertyId_weekStartDate: {
            propertyId: string;
            weekStartDate: Date;
          };
        };
      }) => {
        const schedule = findScheduleByComposite(
          args.where.propertyId_weekStartDate.propertyId,
          args.where.propertyId_weekStartDate.weekStartDate
        );

        if (!schedule) {
          return null;
        }

        return {
          ...schedule,
          publishedByUser: buildPublishedByUser(schedule.publishedByUserId),
        };
      },
      update: async (args: {
        data: Partial<ScheduleRow>;
        where: {
          id: string;
        };
      }) => {
        const schedule = schedules.find((entry) => entry.id === args.where.id);

        if (!schedule) {
          throw new Error("Schedule not found.");
        }

        Object.assign(schedule, args.data, { updatedAt: now });
        return schedule;
      },
      upsert: async (args: {
        create: {
          organizationId: string;
          propertyId: string;
          status: string;
          weekStartDate: Date;
        };
        select: {
          createdAt: true;
          id: true;
          propertyId: true;
          publishedAt: true;
          publishedByUser: true;
          publishedByUserId: true;
          status: true;
          updatedAt: true;
          weekStartDate: true;
        };
        update: Record<string, never>;
        where: {
          propertyId_weekStartDate: {
            propertyId: string;
            weekStartDate: Date;
          };
        };
      }) => {
        const existingSchedule = findScheduleByComposite(
          args.where.propertyId_weekStartDate.propertyId,
          args.where.propertyId_weekStartDate.weekStartDate
        );

        if (existingSchedule) {
          return {
            ...existingSchedule,
            publishedByUser: buildPublishedByUser(existingSchedule.publishedByUserId),
          };
        }

        const schedule: ScheduleRow = {
          createdAt: now,
          id: `schedule-${scheduleCounter}`,
          organizationId: args.create.organizationId,
          propertyId: args.create.propertyId,
          publishedAt: null,
          publishedByUserId: null,
          status: args.create.status,
          updatedAt: now,
          weekStartDate: args.create.weekStartDate,
        };

        scheduleCounter += 1;
        schedules.push(schedule);

        return {
          ...schedule,
          publishedByUser: null,
        };
      },
    },
    scheduleTemplate: {
      create: async (args: {
        data: {
          createdByUserId: string;
          name: string;
          organizationId: string;
          propertyId: string;
          shifts?: {
            create: Array<Omit<ScheduleTemplateShiftRow, "createdAt" | "id" | "templateId" | "updatedAt">>;
          };
          slotIndex: number;
          updatedByUserId: string;
        };
      }) => {
        const template: ScheduleTemplateRow = {
          createdAt: now,
          createdByUserId: args.data.createdByUserId,
          id: `schedule-template-${scheduleTemplateCounter}`,
          name: args.data.name,
          organizationId: args.data.organizationId,
          propertyId: args.data.propertyId,
          slotIndex: args.data.slotIndex,
          updatedAt: now,
          updatedByUserId: args.data.updatedByUserId,
        };

        scheduleTemplateCounter += 1;
        scheduleTemplates.push(template);

        for (const shiftData of args.data.shifts?.create ?? []) {
          scheduleTemplateShifts.push({
            ...shiftData,
            createdAt: now,
            id: `schedule-template-shift-${scheduleTemplateShiftCounter}`,
            templateId: template.id,
            updatedAt: now,
          });
          scheduleTemplateShiftCounter += 1;
        }

        return buildTemplateRecordWithRelations(template);
      },
      delete: async (args: {
        where: {
          id: string;
        };
      }) => {
        const index = scheduleTemplates.findIndex((entry) => entry.id === args.where.id);

        if (index < 0) {
          throw new Error("Schedule template not found.");
        }

        const [deletedTemplate] = scheduleTemplates.splice(index, 1);

        for (let shiftIndex = scheduleTemplateShifts.length - 1; shiftIndex >= 0; shiftIndex -= 1) {
          if (scheduleTemplateShifts[shiftIndex]?.templateId === deletedTemplate?.id) {
            scheduleTemplateShifts.splice(shiftIndex, 1);
          }
        }

        return deletedTemplate;
      },
      findFirst: async (args: {
        include?: {
          shifts: true | {
            include?: {
              employee: {
                select: {
                  employmentStatus: true;
                  firstName: true;
                  id: true;
                  lastName: true;
                };
              };
            };
            orderBy?: Array<Record<string, "asc" | "desc">>;
          };
        };
        where: {
          id?: string;
          organizationId: string;
          propertyId: string;
        };
      }) => {
        const template = scheduleTemplates.find(
          (entry) =>
            entry.organizationId === args.where.organizationId &&
            entry.propertyId === args.where.propertyId &&
            (args.where.id ? entry.id === args.where.id : true)
        );

        if (!template) {
          return null;
        }

        return args.include?.shifts ? buildTemplateRecordWithRelations(template) : template;
      },
      findMany: async (args: {
        include?: {
          shifts: true | {
            include?: {
              employee: {
                select: {
                  employmentStatus: true;
                  firstName: true;
                  id: true;
                  lastName: true;
                };
              };
            };
            orderBy?: Array<Record<string, "asc" | "desc">>;
          };
        };
        orderBy?: {
          slotIndex: "asc" | "desc";
        };
        where: {
          organizationId: string;
          propertyId: string;
        };
      }) =>
        scheduleTemplates
          .filter(
            (template) =>
              template.organizationId === args.where.organizationId && template.propertyId === args.where.propertyId
          )
          .sort((left, right) => left.slotIndex - right.slotIndex)
          .map((template) => (args.include?.shifts ? buildTemplateRecordWithRelations(template) : template)),
      findUnique: async (args: {
        select?: {
          id: true;
        };
        where: {
          propertyId_slotIndex: {
            propertyId: string;
            slotIndex: number;
          };
        };
      }) => {
        const template =
          scheduleTemplates.find(
            (entry) =>
              entry.propertyId === args.where.propertyId_slotIndex.propertyId &&
              entry.slotIndex === args.where.propertyId_slotIndex.slotIndex
          ) ?? null;

        if (!template) {
          return null;
        }

        return args.select ? { id: template.id } : buildTemplateRecordWithRelations(template);
      },
      update: async (args: {
        data: Partial<ScheduleTemplateRow>;
        where: {
          id: string;
        };
      }) => {
        const template = scheduleTemplates.find((entry) => entry.id === args.where.id);

        if (!template) {
          throw new Error("Schedule template not found.");
        }

        Object.assign(template, args.data, { updatedAt: now });
        return buildTemplateRecordWithRelations(template);
      },
    },
    scheduleTemplateShift: {
      createMany: async (args: {
        data: Array<Omit<ScheduleTemplateShiftRow, "createdAt" | "id" | "updatedAt">>;
      }) => {
        for (const shiftData of args.data) {
          scheduleTemplateShifts.push({
            ...shiftData,
            createdAt: now,
            id: `schedule-template-shift-${scheduleTemplateShiftCounter}`,
            updatedAt: now,
          });
          scheduleTemplateShiftCounter += 1;
        }

        return {
          count: args.data.length,
        };
      },
      deleteMany: async (args: {
        where: {
          templateId: string;
        };
      }) => {
        let count = 0;

        for (let index = scheduleTemplateShifts.length - 1; index >= 0; index -= 1) {
          if (scheduleTemplateShifts[index]?.templateId === args.where.templateId) {
            scheduleTemplateShifts.splice(index, 1);
            count += 1;
          }
        }

        return { count };
      },
    },
    shift: {
      create: async (args: {
        data: Omit<ShiftRow, "createdAt" | "id" | "updatedAt">;
      }) => {
        const shift: ShiftRow = {
          ...args.data,
          createdAt: now,
          id: `shift-${shiftCounter}`,
          updatedAt: now,
        };

        shiftCounter += 1;
        shifts.push(shift);
        return shift;
      },
      deleteMany: async (args: {
        where: {
          scheduleId: string;
        };
      }) => {
        let count = 0;

        for (let index = shifts.length - 1; index >= 0; index -= 1) {
          if (shifts[index]?.scheduleId === args.where.scheduleId) {
            shifts.splice(index, 1);
            count += 1;
          }
        }

        return { count };
      },
      delete: async (args: {
        where: {
          id: string;
        };
      }) => {
        const index = shifts.findIndex((shift) => shift.id === args.where.id);

        if (index < 0) {
          throw new Error("Shift not found.");
        }

        const [deletedShift] = shifts.splice(index, 1);
        return deletedShift;
      },
      findFirst: async (args: {
        include?: {
          schedule: {
            select: {
              id: true;
              status: true;
              weekStartDate: true;
            };
          };
        };
        select?: {
          id: true;
        };
        where: {
          employeeId?: string;
          endAt?: {
            gt: Date;
          };
          id?: string | { not: string };
          organizationId: string;
          propertyId?: string;
          startAt?: {
            lt: Date;
          };
          status?: {
            not: string;
          };
        };
      }) => {
        const match = shifts.find((shift) => {
          if (shift.organizationId !== args.where.organizationId) {
            return false;
          }

          if (typeof args.where.id === "string" && shift.id !== args.where.id) {
            return false;
          }

          if (typeof args.where.id === "object" && shift.id === args.where.id.not) {
            return false;
          }

          if (args.where.propertyId && shift.propertyId !== args.where.propertyId) {
            return false;
          }

          if (args.where.employeeId && shift.employeeId !== args.where.employeeId) {
            return false;
          }

          if (args.where.status?.not && shift.status === args.where.status.not) {
            return false;
          }

          if (args.where.startAt && !(shift.startAt.getTime() < args.where.startAt.lt.getTime())) {
            return false;
          }

          if (args.where.endAt && !(shift.endAt.getTime() > args.where.endAt.gt.getTime())) {
            return false;
          }

          return true;
        });

        if (!match) {
          return null;
        }

        if (args.select) {
          return {
            id: match.id,
          };
        }

        if (args.include?.schedule) {
          const schedule = schedules.find((entry) => entry.id === match.scheduleId);

          return {
            ...match,
            schedule: schedule
              ? {
                  id: schedule.id,
                  status: schedule.status,
                  weekStartDate: schedule.weekStartDate,
                }
              : null,
          };
        }

        return match;
      },
      findMany: async (args: {
        include: {
          employee: {
            select: {
              employmentStatus: true;
              firstName: true;
              id: true;
              lastName: true;
            };
          };
        };
        where: {
          scheduleId: string;
        };
      }) =>
        shifts
          .filter((shift) => shift.scheduleId === args.where.scheduleId)
          .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())
          .map((shift) => {
            const employee = shift.employeeId ? employees.find((entry) => entry.id === shift.employeeId) ?? null : null;

            return {
              ...shift,
              employee,
            };
          }),
      update: async (args: {
        data: Partial<ShiftRow>;
        where: {
          id: string;
        };
      }) => {
        const shift = shifts.find((entry) => entry.id === args.where.id);

        if (!shift) {
          throw new Error("Shift not found.");
        }

        Object.assign(shift, args.data, { updatedAt: now });
        return shift;
      },
    },
  };

  Object.assign(db, {
    __state: {
      assignments,
      employees,
      scheduleTemplateShifts,
      scheduleTemplates,
      schedules,
      shifts,
    },
  });

  return db;
}

type FakeSchedulingDb = ReturnType<typeof createFakeSchedulingDb>;

test("getPropertyScheduleWeek normalizes by payroll week start and falls back to Monday", async () => {
  const context = createContext();
  const sundayStartDb = createFakeSchedulingDb({
    weekStartsOnByProperty: {
      "property-1": 0,
    },
  });
  const mondayStartDb = createFakeSchedulingDb();

  const sundayWeek = await getPropertyScheduleWeek(context, "2026-04-23", {
    now: () => new Date("2026-04-23T15:00:00.000Z"),
    prisma: sundayStartDb as never,
  });
  const mondayWeek = await getPropertyScheduleWeek(context, "2026-04-23", {
    now: () => new Date("2026-04-23T15:00:00.000Z"),
    prisma: mondayStartDb as never,
  });

  assert.equal(sundayWeek.weekStartDate, "2026-04-19");
  assert.equal(sundayWeek.status, "draft");
  assert.equal(sundayWeek.scheduleId, null);
  assert.equal(sundayWeek.shifts.length, 0);
  assert.equal(mondayWeek.weekStartDate, "2026-04-20");
});

test("create, publish, edit, and delete shift keeps the property week in sync and reverts published schedules back to draft", async () => {
  const context = createContext();
  const db = createFakeSchedulingDb({
    assignments: [
      {
        activeFrom: null,
        activeTo: null,
        employeeId: "employee-1",
        propertyId: "property-1",
      },
    ],
    employees: [
      {
        employmentStatus: "active",
        firstName: "Ava",
        id: "employee-1",
        lastName: "Stone",
        organizationId: "org-1",
        terminatedAt: null,
      },
    ],
    payRates: [
      {
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: null,
        employeeId: "employee-1",
        organizationId: "org-1",
        propertyId: "property-1",
        title: "Front Desk",
      },
    ],
  });

  const createdWeek = await createPropertyShift(
    context,
    {
      date: "2026-04-23",
      employeeId: "employee-1",
      endTime: "17:00",
      startTime: "09:00",
    },
    {
      now: () => new Date("2026-04-23T15:00:00.000Z"),
      prisma: db as never,
    }
  );

  assert.equal(createdWeek.shifts.length, 1);
  assert.equal(createdWeek.shifts[0]?.positionLabel, "Front Desk");
  assert.equal(createdWeek.status, "draft");

  const publishedWeek = await publishPropertySchedule(context, createdWeek.weekStartDate, {
    now: () => new Date("2026-04-23T16:00:00.000Z"),
    prisma: db as never,
  });

  assert.equal(publishedWeek.status, "published");
  assert.ok(publishedWeek.publishedAt);

  const updatedWeek = await updatePropertyShift(
    context,
    createdWeek.shifts[0]!.id,
    {
      endTime: "18:00",
    },
    {
      now: () => new Date("2026-04-23T17:00:00.000Z"),
      prisma: db as never,
    }
  );

  assert.equal(updatedWeek.status, "draft");
  assert.equal(updatedWeek.shifts[0]?.endTime, "18:00");

  const deletedWeek = await deletePropertyShift(context, createdWeek.shifts[0]!.id, {
    now: () => new Date("2026-04-23T18:00:00.000Z"),
    prisma: db as never,
  });

  assert.equal(deletedWeek.shifts.length, 0);
  assert.equal(deletedWeek.status, "draft");
});

test("createPropertyShift rejects overlapping shifts for the same employee even across properties", async () => {
  const context = createContext();
  const db = createFakeSchedulingDb({
    assignments: [
      {
        activeFrom: null,
        activeTo: null,
        employeeId: "employee-1",
        propertyId: "property-1",
      },
    ],
    employees: [
      {
        employmentStatus: "active",
        firstName: "Ava",
        id: "employee-1",
        lastName: "Stone",
        organizationId: "org-1",
        terminatedAt: null,
      },
    ],
    schedules: [
      {
        createdAt: new Date("2026-04-20T08:00:00.000Z"),
        id: "schedule-existing",
        organizationId: "org-1",
        propertyId: "property-2",
        publishedAt: null,
        publishedByUserId: null,
        status: "draft",
        updatedAt: new Date("2026-04-20T08:00:00.000Z"),
        weekStartDate: new Date("2026-04-20T00:00:00.000Z"),
      },
    ],
    shifts: [
      {
        breakMinutes: 0,
        createdAt: new Date("2026-04-20T08:00:00.000Z"),
        createdByUserId: "user-2",
        date: new Date("2026-04-23T00:00:00.000Z"),
        employeeId: "employee-1",
        endAt: new Date("2026-04-23T20:00:00.000Z"),
        id: "shift-existing",
        notes: null,
        organizationId: "org-1",
        positionLabel: "Night Audit",
        propertyId: "property-2",
        scheduleId: "schedule-existing",
        startAt: new Date("2026-04-23T17:00:00.000Z"),
        status: "scheduled",
        updatedAt: new Date("2026-04-20T08:00:00.000Z"),
        updatedByUserId: "user-2",
      },
    ],
  });

  await assert.rejects(
    () =>
      createPropertyShift(
        context,
        {
          date: "2026-04-23",
          employeeId: "employee-1",
          endTime: "17:30",
          startTime: "13:30",
        },
        {
          now: () => new Date("2026-04-23T15:00:00.000Z"),
          prisma: db as never,
        }
      ),
    /overlapping shift/i
  );
});

test("createPropertyShift rejects inactive employees and inactive property assignments", async () => {
  const inactiveEmployeeContext = createContext();
  const inactiveEmployeeDb = createFakeSchedulingDb({
    assignments: [
      {
        activeFrom: null,
        activeTo: null,
        employeeId: "employee-1",
        propertyId: "property-1",
      },
    ],
    employees: [
      {
        employmentStatus: "inactive",
        firstName: "Ava",
        id: "employee-1",
        lastName: "Stone",
        organizationId: "org-1",
        terminatedAt: null,
      },
    ],
  });
  const inactiveAssignmentDb = createFakeSchedulingDb({
    assignments: [
      {
        activeFrom: null,
        activeTo: new Date("2026-04-22T23:59:59.000Z"),
        employeeId: "employee-2",
        propertyId: "property-1",
      },
    ],
    employees: [
      {
        employmentStatus: "active",
        firstName: "Noah",
        id: "employee-2",
        lastName: "Parker",
        organizationId: "org-1",
        terminatedAt: null,
      },
    ],
  });

  await assert.rejects(
    () =>
      createPropertyShift(
        inactiveEmployeeContext,
        {
          date: "2026-04-23",
          employeeId: "employee-1",
          endTime: "17:00",
          startTime: "09:00",
        },
        {
          prisma: inactiveEmployeeDb as never,
        }
      ),
    /inactive or terminated/i
  );

  await assert.rejects(
    () =>
      createPropertyShift(
        inactiveEmployeeContext,
        {
          date: "2026-04-23",
          employeeId: "employee-2",
          endTime: "17:00",
          startTime: "09:00",
        },
        {
          prisma: inactiveAssignmentDb as never,
        }
      ),
    /not assigned to the selected property/i
  );
});

test("schedule services enforce read and write permissions", async () => {
  const readOnlyContext = createContext({
    permissionKeys: [PERMISSIONS.SCHEDULE_READ],
  });
  const noReadContext = createContext({
    permissionKeys: [],
  });
  const db = createFakeSchedulingDb();

  await assert.rejects(
    () =>
      createPropertyShift(
        readOnlyContext,
        {
          date: "2026-04-23",
          employeeId: "employee-1",
          endTime: "17:00",
          startTime: "09:00",
        },
        {
          prisma: db as never,
        }
      ),
    /permission to manage schedules/i
  );

  await assert.rejects(
    () =>
      getPropertyScheduleWeek(noReadContext, "2026-04-23", {
        prisma: db as never,
      }),
    /permission to view schedules/i
  );
});

test("organization scheduling summary stays scoped to allowed properties when property scope cannot be bypassed", async () => {
  const db = createFakeSchedulingDb({
    memberships: [
      {
        organizationId: "org-1",
        permissions: [PERMISSIONS.SCHEDULE_READ],
        status: "active",
        userId: "user-1",
      },
    ],
    propertyAccess: [
      {
        propertyId: "property-1",
        userId: "user-1",
      },
    ],
    schedules: [
      {
        createdAt: new Date("2026-04-20T08:00:00.000Z"),
        id: "schedule-1",
        organizationId: "org-1",
        propertyId: "property-1",
        publishedAt: new Date("2026-04-20T10:00:00.000Z"),
        publishedByUserId: "user-1",
        status: "published",
        updatedAt: new Date("2026-04-20T10:00:00.000Z"),
        weekStartDate: new Date("2026-04-20T00:00:00.000Z"),
      },
    ],
    shifts: [
      {
        breakMinutes: 0,
        createdAt: new Date("2026-04-20T08:00:00.000Z"),
        createdByUserId: "user-1",
        date: new Date("2026-04-23T00:00:00.000Z"),
        employeeId: null,
        endAt: new Date("2026-04-23T17:00:00.000Z"),
        id: "shift-1",
        notes: null,
        organizationId: "org-1",
        positionLabel: null,
        propertyId: "property-1",
        scheduleId: "schedule-1",
        startAt: new Date("2026-04-23T09:00:00.000Z"),
        status: "open",
        updatedAt: new Date("2026-04-20T08:00:00.000Z"),
        updatedByUserId: "user-1",
      },
    ],
    weekStartsOnByProperty: {
      "property-1": 1,
      "property-2": 1,
    },
  });

  const overview = await getOrganizationSchedulingSummary(
    {
      organizationId: "org-1",
      userId: "user-1",
    },
    {
      now: () => new Date("2026-04-23T15:00:00.000Z"),
      prisma: db as never,
    }
  );

  assert.equal(overview.properties.length, 1);
  assert.equal(overview.properties[0]?.propertyId, "property-1");
  assert.equal(overview.properties[0]?.status, "published");
  assert.equal(overview.summary.publishedProperties, 1);
  assert.equal(overview.summary.unpublishedProperties, 0);
  assert.equal(overview.summary.scheduledShiftCount, 1);
});

test("property schedule templates can be created, edited, listed, and deleted", async () => {
  const context = createContext();
  const db = createFakeSchedulingDb({
    assignments: [
      {
        activeFrom: null,
        activeTo: null,
        employeeId: "employee-1",
        propertyId: "property-1",
      },
    ],
    employees: [
      {
        employmentStatus: "active",
        firstName: "Ava",
        id: "employee-1",
        lastName: "Stone",
        organizationId: "org-1",
        terminatedAt: null,
      },
    ],
  });

  const createdTemplates = await createPropertyScheduleTemplate(
    context,
    {
      name: "Weekend Core",
      slotIndex: 1,
    },
    {
      prisma: db as never,
    }
  );

  assert.equal(createdTemplates.templates.length, 1);
  assert.equal(createdTemplates.templates[0]?.name, "Weekend Core");

  const updatedTemplates = await updatePropertyScheduleTemplate(
    context,
    createdTemplates.templates[0]!.id,
    {
      name: "Weekend Core v2",
      shifts: [
        {
          breakMinutes: 30,
          dayIndex: 0,
          employeeId: "employee-1",
          endMinutes: 15 * 60,
          isOvernight: false,
          notes: "Lobby coverage",
          positionLabel: "Front Desk",
          startMinutes: 7 * 60,
          status: "scheduled",
        },
        {
          breakMinutes: 0,
          dayIndex: 1,
          employeeId: null,
          endMinutes: 23 * 60,
          isOvernight: false,
          notes: null,
          positionLabel: "Breakfast",
          startMinutes: 15 * 60,
          status: "open",
        },
      ],
    },
    {
      prisma: db as never,
    }
  );

  assert.equal(updatedTemplates.templates[0]?.name, "Weekend Core v2");
  assert.equal(updatedTemplates.templates[0]?.shiftCount, 2);
  assert.equal(updatedTemplates.templates[0]?.shifts[0]?.employeeId, "employee-1");
  assert.equal(updatedTemplates.templates[0]?.shifts[1]?.status, "open");

  const listedTemplates = await listPropertyScheduleTemplates(context, {
    prisma: db as never,
  });

  assert.equal(listedTemplates.templates.length, 1);
  assert.equal(listedTemplates.templates[0]?.shifts.length, 2);

  const deletedTemplates = await deletePropertyScheduleTemplate(
    context,
    createdTemplates.templates[0]!.id,
    {
      prisma: db as never,
    }
  );

  assert.equal(deletedTemplates.templates.length, 0);
});

test("template slots are limited to three and overlapping template shifts are rejected", async () => {
  const context = createContext();
  const db = createFakeSchedulingDb({
    assignments: [
      {
        activeFrom: null,
        activeTo: null,
        employeeId: "employee-1",
        propertyId: "property-1",
      },
    ],
    employees: [
      {
        employmentStatus: "active",
        firstName: "Ava",
        id: "employee-1",
        lastName: "Stone",
        organizationId: "org-1",
        terminatedAt: null,
      },
    ],
  });

  await createPropertyScheduleTemplate(context, { slotIndex: 1 }, { prisma: db as never });
  await createPropertyScheduleTemplate(context, { slotIndex: 2 }, { prisma: db as never });
  await createPropertyScheduleTemplate(context, { slotIndex: 3 }, { prisma: db as never });

  await assert.rejects(
    () =>
      createPropertyScheduleTemplate(
        context,
        {
          slotIndex: 4,
        },
        {
          prisma: db as never,
        }
      ),
    /between 1 and 3/i
  );

  const templates = await listPropertyScheduleTemplates(context, {
    prisma: db as never,
  });

  await assert.rejects(
    () =>
      updatePropertyScheduleTemplate(
        context,
        templates.templates[0]!.id,
        {
          shifts: [
            {
              breakMinutes: 0,
              dayIndex: 2,
              employeeId: "employee-1",
              endMinutes: 15 * 60,
              isOvernight: false,
              startMinutes: 7 * 60,
              status: "scheduled",
            },
            {
              breakMinutes: 0,
              dayIndex: 2,
              employeeId: "employee-1",
              endMinutes: 17 * 60,
              isOvernight: false,
              startMinutes: 14 * 60,
              status: "scheduled",
            },
          ],
        },
        {
          prisma: db as never,
        }
      ),
    /cannot overlap/i
  );
});

test("applying a saved template replaces the target week, resets published schedules to draft, and skips invalid employees", async () => {
  const context = createContext();
  const db = createFakeSchedulingDb({
    assignments: [
      {
        activeFrom: null,
        activeTo: null,
        employeeId: "employee-1",
        propertyId: "property-1",
      },
      {
        activeFrom: null,
        activeTo: null,
        employeeId: "employee-2",
        propertyId: "property-1",
      },
    ],
    employees: [
      {
        employmentStatus: "active",
        firstName: "Ava",
        id: "employee-1",
        lastName: "Stone",
        organizationId: "org-1",
        terminatedAt: null,
      },
      {
        employmentStatus: "active",
        firstName: "Noah",
        id: "employee-2",
        lastName: "Parker",
        organizationId: "org-1",
        terminatedAt: null,
      },
    ],
    payRates: [
      {
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: null,
        employeeId: "employee-1",
        organizationId: "org-1",
        propertyId: "property-1",
        title: "Front Desk",
      },
      {
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: null,
        employeeId: "employee-2",
        organizationId: "org-1",
        propertyId: "property-1",
        title: "Housekeeping",
      },
    ],
  });

  await createPropertyShift(
    context,
    {
      date: "2026-04-21",
      employeeId: "employee-1",
      endTime: "15:00",
      startTime: "07:00",
    },
    {
      now: () => new Date("2026-04-21T15:00:00.000Z"),
      prisma: db as never,
    }
  );

  await createPropertyShift(
    context,
    {
      date: "2026-04-22",
      employeeId: "employee-2",
      endTime: "23:00",
      startTime: "15:00",
    },
    {
      now: () => new Date("2026-04-22T15:00:00.000Z"),
      prisma: db as never,
    }
  );

  const createdTemplates = await createPropertyScheduleTemplate(
    context,
    {
      slotIndex: 1,
      sourceWeekStartDate: "2026-04-20",
    },
    {
      prisma: db as never,
    }
  );

  const targetWeek = await createPropertyShift(
    context,
    {
      date: "2026-04-28",
      employeeId: "employee-1",
      endTime: "14:00",
      startTime: "06:00",
    },
    {
      now: () => new Date("2026-04-28T15:00:00.000Z"),
      prisma: db as never,
    }
  );

  await publishPropertySchedule(context, targetWeek.weekStartDate, {
    now: () => new Date("2026-04-28T16:00:00.000Z"),
    prisma: db as never,
  });

  const state = (db as FakeSchedulingDb & { __state: { employees: EmployeeRow[] } }).__state;
  const inactiveEmployee = state.employees.find((employee: EmployeeRow) => employee.id === "employee-2");
  assert.ok(inactiveEmployee);
  inactiveEmployee.employmentStatus = "inactive";

  const appliedTemplate = await applyPropertyScheduleTemplate(
    context,
    createdTemplates.templates[0]!.id,
    "2026-04-27",
    {
      now: () => new Date("2026-04-28T17:00:00.000Z"),
      prisma: db as never,
    }
  );

  assert.equal(appliedTemplate.week.status, "draft");
  assert.equal(appliedTemplate.week.shifts.length, 1);
  assert.equal(appliedTemplate.summary.appliedShiftCount, 1);
  assert.equal(appliedTemplate.summary.skippedShiftCount, 1);
  assert.equal(appliedTemplate.summary.skippedItems[0]?.reason, "employee_inactive");
  assert.equal(appliedTemplate.week.shifts[0]?.startTime, "07:00");
  assert.equal(appliedTemplate.week.shifts[0]?.positionLabel, "Front Desk");
  assert.equal(appliedTemplate.week.shifts.some((shift) => shift.startTime === "06:00"), false);
});

test("template services allow read access but enforce write permissions for template changes and apply actions", async () => {
  const readOnlyContext = createContext({
    permissionKeys: [PERMISSIONS.SCHEDULE_READ],
  });
  const db = createFakeSchedulingDb();

  const listedTemplates = await listPropertyScheduleTemplates(readOnlyContext, {
    prisma: db as never,
  });

  assert.equal(listedTemplates.templates.length, 0);

  await assert.rejects(
    () =>
      createPropertyScheduleTemplate(
        readOnlyContext,
        {
          slotIndex: 1,
        },
        {
          prisma: db as never,
        }
      ),
    /permission to manage schedules/i
  );

  await assert.rejects(
    () =>
      applyPropertyScheduleTemplate(readOnlyContext, "template-1", "2026-04-27", {
        prisma: db as never,
      }),
    /permission to manage schedules/i
  );
});
