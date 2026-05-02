import { prisma } from "../src/lib/prisma";
import type { PropertyRequestContext } from "../src/modules/property/property.middleware";
import {
  approvePropertyPayrollEmployee,
  createPropertyPayrollRun,
  finalizePropertyPayrollRun,
} from "../src/modules/property/property-payroll-runs";

const MARKER = "[boost-demo-seed]";
const ORGANIZATION_SLUG = "boost-hosp";
const OWNER_EMAIL = "roniliz0909@gmail.com";
const ADMIN_EMAIL = "majorsingh2406@gmail.com";
const HR_EMAIL = "hr@lts.com";
const MANAGER_EMAIL = "manager2@lts.com";
const CURRENT_SEED_DATE = process.env.BOOST_DEMO_CURRENT_DATE ?? "2026-04-30";

const PAYROLL_WINDOWS = [
  { startDate: "2026-03-29", endDate: "2026-04-11", runMode: "finalized" as const },
  { startDate: "2026-04-12", endDate: "2026-04-25", runMode: "in_review" as const },
  { startDate: "2026-04-26", endDate: "2026-05-09", runMode: "time_only" as const },
  { startDate: "2026-05-10", endDate: "2026-05-23", runMode: "none" as const },
];

const SCHEDULE_WEEK_STARTS = [
  "2026-03-23",
  "2026-03-30",
  "2026-04-06",
  "2026-04-13",
  "2026-04-20",
  "2026-04-27",
  "2026-05-04",
  "2026-05-11",
  "2026-05-18",
];

const PROPERTY_NAMES = ["Candlewood Suites", "Irish Lodge"];
const EMPLOYEE_NAMES = ["Boost 1", "Boost 2", "Boost 3", "Boost 4"];
const ROLE_NAMES_BY_EMAIL = new Map([
  [HR_EMAIL, "HR"],
  [MANAGER_EMAIL, "Manager"],
]);

type CoreData = Awaited<ReturnType<typeof loadCoreData>>;
type PropertyRecord = CoreData["properties"][number];
type EmployeeRecord = CoreData["employees"][number];

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let cursor = parseDateOnly(startDate); cursor <= parseDateOnly(endDate); cursor = addDays(cursor, 1)) {
    dates.push(formatDateOnly(cursor));
  }
  return dates;
}

function localDateTime(date: string, hour: number, minute: number): Date {
  const paddedHour = String(hour).padStart(2, "0");
  const paddedMinute = String(minute).padStart(2, "0");
  return new Date(`${date}T${paddedHour}:${paddedMinute}:00-05:00`);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function minutesBetween(startAt: Date, endAt: Date): number {
  return Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
}

function seededInt(seed: string, minInclusive: number, maxInclusive: number): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const range = maxInclusive - minInclusive + 1;
  return minInclusive + (Math.abs(hash) % range);
}

function resolveEmployeeByFirstName(employees: EmployeeRecord[], firstName: string): EmployeeRecord {
  const employee = employees.find((candidate) => candidate.firstName === firstName);
  if (!employee) {
    throw new Error(`Required employee not found: ${firstName}`);
  }

  return employee;
}

function chooseEmployeeForSlot(
  employees: EmployeeRecord[],
  propertyIndex: number,
  dayIndex: number,
  slotIndex: number
): EmployeeRecord {
  const baseOffset = propertyIndex === 0 ? 0 : 2;
  const rotation = (dayIndex + slotIndex) % 2;
  const occasionalSwap = dayIndex % 6 === 0 ? 2 : 0;
  return employees[(baseOffset + rotation + slotIndex + occasionalSwap) % employees.length];
}

function buildContext(core: CoreData, property: PropertyRecord): PropertyRequestContext {
  const adminMembership = core.memberships.find((membership) => membership.user.email === ADMIN_EMAIL);
  if (!adminMembership) {
    throw new Error(`Admin organization membership not found for ${ADMIN_EMAIL}`);
  }

  const admin = adminMembership.user;
  const organizationPermissions = adminMembership.role.permissions.map((permission) => permission.key);

  return {
    authUser: {
      token: "boost-demo-seed",
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      avatarUrl: admin.avatarUrl,
      phone: admin.phone,
      role: null,
    },
    localUser: {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      phone: admin.phone,
      avatarUrl: admin.avatarUrl,
      lastActiveOrganizationId: core.organization.id,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    },
    property: {
      id: property.id,
      organizationId: property.organizationId,
      name: property.name,
      code: property.code,
      timezone: property.timezone,
      addressLine1: property.addressLine1,
      addressLine2: property.addressLine2,
      city: property.city,
      stateRegion: property.stateRegion,
      postalCode: property.postalCode,
      countryCode: property.countryCode,
      status: property.status,
    },
    organizationMembership: {
      id: adminMembership.id,
      organizationId: adminMembership.organizationId,
      userId: adminMembership.userId,
      status: adminMembership.status,
      role: {
        id: adminMembership.role.id,
        name: adminMembership.role.name,
        permissions: adminMembership.role.permissions.map((permission) => ({ key: permission.key })),
      },
    },
    propertyUserRole: null,
    permissions: {
      organization: organizationPermissions,
      property: [],
      effective: Array.from(new Set([...organizationPermissions, "payroll.write", "schedule.write"])).sort(),
      canBypassPropertyScope: true,
    },
  };
}

async function loadCoreData() {
  const organization = await prisma.organization.findFirst({
    where: {
      OR: [{ slug: ORGANIZATION_SLUG }, { ownerUser: { email: OWNER_EMAIL } }],
    },
    include: {
      ownerUser: true,
    },
  });

  if (!organization) {
    throw new Error(`Required organization not found: slug=${ORGANIZATION_SLUG}, owner=${OWNER_EMAIL}`);
  }

  const [properties, employees, memberships, roles] = await Promise.all([
    prisma.property.findMany({
      where: {
        organizationId: organization.id,
        name: { in: PROPERTY_NAMES },
      },
      include: {
        payrollSettings: {
          orderBy: { effectiveFrom: "desc" },
          include: { payrollCalendar: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: {
        organizationId: organization.id,
        OR: EMPLOYEE_NAMES.map((name) => {
          const [firstName, lastName] = name.split(" ");
          return { firstName, lastName };
        }),
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.organizationMember.findMany({
      where: {
        organizationId: organization.id,
        user: {
          email: { in: [OWNER_EMAIL, ADMIN_EMAIL, HR_EMAIL, MANAGER_EMAIL] },
        },
      },
      include: {
        user: true,
        role: {
          include: {
            permissions: true,
          },
        },
      },
    }),
    prisma.organizationRole.findMany({
      where: {
        organizationId: organization.id,
        name: { in: ["HR", "Manager"] },
      },
    }),
  ]);

  for (const propertyName of PROPERTY_NAMES) {
    if (!properties.some((property) => property.name === propertyName)) {
      throw new Error(`Required property not found in ${organization.name}: ${propertyName}`);
    }
  }

  for (const employeeName of EMPLOYEE_NAMES) {
    const [firstName, lastName] = employeeName.split(" ");
    if (!employees.some((employee) => employee.firstName === firstName && employee.lastName === lastName)) {
      throw new Error(`Required employee not found in ${organization.name}: ${employeeName}`);
    }
  }

  for (const email of [OWNER_EMAIL, ADMIN_EMAIL, HR_EMAIL, MANAGER_EMAIL]) {
    if (!memberships.some((membership) => membership.user.email === email)) {
      throw new Error(`Required organization member not found in ${organization.name}: ${email}`);
    }
  }

  for (const property of properties) {
    if (property.payrollSettings.length === 0) {
      throw new Error(`Property has no payroll setting: ${property.name}`);
    }
  }

  return { organization, properties, employees, memberships, roles };
}

async function ensurePropertyAccess(core: CoreData): Promise<void> {
  for (const membership of core.memberships) {
    const roleName = ROLE_NAMES_BY_EMAIL.get(membership.user.email);
    if (!roleName) {
      continue;
    }

    const role = core.roles.find((candidate) => candidate.name === roleName);
    if (!role) {
      throw new Error(`Required organization role not found: ${roleName}`);
    }

    for (const property of core.properties) {
      await prisma.propertyUserRole.upsert({
        where: {
          propertyId_userId: {
            propertyId: property.id,
            userId: membership.userId,
          },
        },
        update: {
          roleId: role.id,
        },
        create: {
          propertyId: property.id,
          userId: membership.userId,
          roleId: role.id,
        },
      });
    }
  }
}

async function ensureEmployeeAssignments(core: CoreData): Promise<void> {
  for (const employee of core.employees) {
    for (const property of core.properties) {
      await prisma.employeePropertyAssignment.upsert({
        where: {
          employeeId_propertyId: {
            employeeId: employee.id,
            propertyId: property.id,
          },
        },
        update: {
          activeTo: null,
        },
        create: {
          employeeId: employee.id,
          propertyId: property.id,
          isPrimary: property.name === "Irish Lodge",
          activeFrom: parseDateOnly("2026-03-01"),
          activeTo: null,
        },
      });
    }
  }
}

async function cleanupSeededData(core: CoreData): Promise<void> {
  const propertyIds = core.properties.map((property) => property.id);
  const adminMembership = core.memberships.find((membership) => membership.user.email === ADMIN_EMAIL);

  if (adminMembership) {
    const emptyFailedRuns = await prisma.payrollRun.findMany({
      where: {
        propertyId: { in: propertyIds },
        requestedByUserId: adminMembership.userId,
        status: "draft",
        notes: null,
        OR: PAYROLL_WINDOWS.map((window) => ({
          payrollPeriod: {
            periodStartDate: parseDateOnly(window.startDate),
            periodEndDate: parseDateOnly(window.endDate),
          },
        })),
      },
      select: {
        id: true,
        _count: {
          select: {
            employeeSummaries: true,
            shiftSnapshots: true,
          },
        },
      },
    });

    const emptyFailedRunIds = emptyFailedRuns
      .filter((run) => run._count.employeeSummaries === 0 && run._count.shiftSnapshots === 0)
      .map((run) => run.id);

    if (emptyFailedRunIds.length > 0) {
      await prisma.payrollRun.deleteMany({
        where: {
          id: { in: emptyFailedRunIds },
        },
      });
    }
  }

  await prisma.payrollRun.deleteMany({
    where: {
      propertyId: { in: propertyIds },
      notes: { contains: MARKER },
    },
  });

  await prisma.employeePayRate.deleteMany({
    where: {
      organizationId: core.organization.id,
      title: { contains: MARKER },
    },
  });

  await prisma.shift.deleteMany({
    where: {
      propertyId: { in: propertyIds },
      notes: { contains: MARKER },
    },
  });

  const seededPunches = await prisma.timePunch.findMany({
    where: {
      propertyId: { in: propertyIds },
      note: { contains: MARKER },
    },
    select: {
      id: true,
    },
  });
  const seededPunchIds = seededPunches.map((punch) => punch.id);

  if (seededPunchIds.length > 0) {
    await prisma.timeShiftSession.deleteMany({
      where: {
        OR: [{ clockInPunchId: { in: seededPunchIds } }, { clockOutPunchId: { in: seededPunchIds } }],
      },
    });

    await prisma.timePunch.deleteMany({
      where: {
        id: { in: seededPunchIds },
      },
    });
  }
}

async function ensurePayrollPeriods(core: CoreData): Promise<void> {
  const businessDate = CURRENT_SEED_DATE;

  for (const property of core.properties) {
    const setting = property.payrollSettings[0];
    for (const window of PAYROLL_WINDOWS) {
      const periodEnd = parseDateOnly(window.endDate);
      const payDate = addDays(periodEnd, setting.payrollCalendar.payDelayDays);

      await prisma.payrollPeriod.upsert({
        where: {
          payrollCalendarId_periodStartDate_periodEndDate: {
            payrollCalendarId: setting.payrollCalendarId,
            periodStartDate: parseDateOnly(window.startDate),
            periodEndDate: periodEnd,
          },
        },
        update: {
          status: businessDate > window.endDate ? "locked" : "open",
          payDate,
        },
        create: {
          organizationId: core.organization.id,
          payrollCalendarId: setting.payrollCalendarId,
          periodStartDate: parseDateOnly(window.startDate),
          periodEndDate: periodEnd,
          payDate,
          status: businessDate > window.endDate ? "locked" : "open",
        },
      });
    }
  }
}

async function seedPayRates(core: CoreData): Promise<void> {
  const titleByEmployee = new Map([
    ["Boost 1", "Front Desk Associate"],
    ["Boost 2", "Housekeeping Lead"],
    ["Boost 3", "Night Auditor"],
    ["Boost 4", "Maintenance Tech"],
  ]);
  const rateByEmployee = new Map([
    ["Boost 1", 1800],
    ["Boost 2", 1680],
    ["Boost 3", 1920],
    ["Boost 4", 2040],
  ]);

  for (const property of core.properties) {
    const setting = property.payrollSettings[0];
    for (const employee of core.employees) {
      const displayName = `${employee.firstName} ${employee.lastName}`;
      await prisma.employeePayRate.create({
        data: {
          organizationId: core.organization.id,
          employeeId: employee.id,
          propertyId: property.id,
          payType: "hourly",
          currency: "USD",
          baseHourlyRateCents: BigInt(rateByEmployee.get(displayName) ?? 1800),
          annualSalaryCents: null,
          overtimePolicyId: setting.defaultOvertimePolicyId,
          title: `${titleByEmployee.get(displayName) ?? "Team Member"} ${MARKER}`,
          effectiveFrom: localDateTime("2026-03-01", 0, 0),
          effectiveTo: null,
        },
      });
    }
  }
}

async function seedSchedules(core: CoreData): Promise<number> {
  let shiftCount = 0;
  const positions = ["Front Desk", "Housekeeping", "Night Audit", "Maintenance"];

  for (const [propertyIndex, property] of core.properties.entries()) {
    for (const weekStartDate of SCHEDULE_WEEK_STARTS) {
      const schedule = await prisma.schedule.upsert({
        where: {
          propertyId_weekStartDate: {
            propertyId: property.id,
            weekStartDate: parseDateOnly(weekStartDate),
          },
        },
        update: {
          status: "published",
          publishedAt: localDateTime(weekStartDate, 9, 0),
          publishedByUserId: core.organization.ownerUserId,
        },
        create: {
          organizationId: core.organization.id,
          propertyId: property.id,
          weekStartDate: parseDateOnly(weekStartDate),
          status: "published",
          publishedAt: localDateTime(weekStartDate, 9, 0),
          publishedByUserId: core.organization.ownerUserId,
        },
      });

      const weekDates = dateRange(weekStartDate, formatDateOnly(addDays(parseDateOnly(weekStartDate), 6)));
      for (const [dayIndex, date] of weekDates.entries()) {
        const slots = [
          { startHour: 7, startMinute: 0, durationMinutes: 510, position: positions[(dayIndex + propertyIndex) % positions.length] },
          { startHour: 15, startMinute: 0, durationMinutes: 510, position: positions[(dayIndex + propertyIndex + 1) % positions.length] },
        ];

        for (const [slotIndex, slot] of slots.entries()) {
          const employee = chooseEmployeeForSlot(core.employees, propertyIndex, dayIndex, slotIndex);
          const startAt = localDateTime(date, slot.startHour, slot.startMinute);
          const endAt = addMinutes(startAt, slot.durationMinutes);

          await prisma.shift.create({
            data: {
              scheduleId: schedule.id,
              organizationId: core.organization.id,
              propertyId: property.id,
              employeeId: employee.id,
              positionLabel: slot.position,
              date: parseDateOnly(date),
              startAt,
              endAt,
              breakMinutes: 30,
              status: "scheduled",
              notes: `${MARKER} realistic demo schedule`,
              createdByUserId: core.organization.ownerUserId,
              updatedByUserId: core.organization.ownerUserId,
            },
          });
          shiftCount += 1;
        }
      }
    }
  }

  return shiftCount;
}

async function createClosedShift(input: {
  organizationId: string;
  property: PropertyRecord;
  employee: EmployeeRecord;
  date: string;
  slotLabel: string;
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  breakMinutes: number;
  createdByUserId: string;
}): Promise<void> {
  const startJitter = seededInt(`${input.property.id}:${input.employee.id}:${input.date}:${input.slotLabel}:in`, -9, 8);
  const endJitter = seededInt(`${input.property.id}:${input.employee.id}:${input.date}:${input.slotLabel}:out`, -7, 13);
  const startedAt = addMinutes(localDateTime(input.date, input.startHour, input.startMinute), startJitter);
  const endedAt = addMinutes(startedAt, input.durationMinutes + endJitter);
  const autoCloseAt = addMinutes(startedAt, (input.property.payrollSettings[0].autoCloseAfterHours ?? 12) * 60);
  const totalMinutes = minutesBetween(startedAt, endedAt);
  const payableMinutes = Math.max(0, totalMinutes - input.breakMinutes);
  const businessDate = parseDateOnly(input.date);
  const note = `${MARKER} ${input.slotLabel}`;

  await prisma.$transaction(async (tx) => {
    const clockInPunch = await tx.timePunch.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.property.id,
        employeeId: input.employee.id,
        propertyDeviceId: null,
        punchType: "clock_in",
        occurredAt: startedAt,
        businessDate,
        source: "kiosk",
        photoUrl: null,
        note,
        status: "valid",
        clientEventId: `boost-demo:${input.property.code ?? input.property.id}:${input.employee.id}:${input.date}:${input.slotLabel}:in`,
        createdByUserId: input.createdByUserId,
      },
    });

    const clockOutPunch = await tx.timePunch.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.property.id,
        employeeId: input.employee.id,
        propertyDeviceId: null,
        punchType: "clock_out",
        occurredAt: endedAt,
        businessDate,
        source: "kiosk",
        photoUrl: null,
        note,
        status: "valid",
        clientEventId: `boost-demo:${input.property.code ?? input.property.id}:${input.employee.id}:${input.date}:${input.slotLabel}:out`,
        createdByUserId: input.createdByUserId,
      },
    });

    const shiftSession = await tx.timeShiftSession.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.property.id,
        employeeId: input.employee.id,
        clockInPunchId: clockInPunch.id,
        clockOutPunchId: clockOutPunch.id,
        startedAt,
        autoCloseAt,
        endedAt,
        businessDate,
        entryMode: "punch",
        status: "closed",
        totalMinutes,
        breakMinutes: input.breakMinutes,
        payableMinutes,
      },
    });

    if (input.breakMinutes > 0) {
      const breakStartedAt = addMinutes(startedAt, Math.floor(totalMinutes / 2) - Math.floor(input.breakMinutes / 2));
      await tx.shiftBreakSegment.create({
        data: {
          shiftSessionId: shiftSession.id,
          breakType: "meal",
          paid: false,
          startedAt: breakStartedAt,
          endedAt: addMinutes(breakStartedAt, input.breakMinutes),
          durationMinutes: input.breakMinutes,
          source: "kiosk",
        },
      });
    }
  });
}

async function seedTimeSessions(core: CoreData): Promise<number> {
  let count = 0;
  const timeWindows = PAYROLL_WINDOWS.filter((window) => window.runMode !== "none");

  for (const [propertyIndex, property] of core.properties.entries()) {
    for (const window of timeWindows) {
      const effectiveEndDate =
        window.runMode === "time_only" && window.endDate > CURRENT_SEED_DATE ? CURRENT_SEED_DATE : window.endDate;
      const dates = dateRange(window.startDate, effectiveEndDate);

      for (const [dayIndex, date] of dates.entries()) {
        const weekday = parseDateOnly(date).getUTCDay();
        const weekend = weekday === 0 || weekday === 6;
        const slots = [
          { label: "am", startHour: 7, startMinute: 0, durationMinutes: weekend ? 450 : 510 },
          { label: "pm", startHour: 15, startMinute: 0, durationMinutes: weekend ? 450 : 510 },
        ];

        for (const [slotIndex, slot] of slots.entries()) {
          const employee = chooseEmployeeForSlot(core.employees, propertyIndex, dayIndex, slotIndex);
          await createClosedShift({
            organizationId: core.organization.id,
            property,
            employee,
            date,
            slotLabel: `${window.startDate}-${slot.label}`,
            startHour: slot.startHour,
            startMinute: slot.startMinute,
            durationMinutes: slot.durationMinutes,
            breakMinutes: slot.durationMinutes >= 360 ? 30 : 0,
            createdByUserId: core.organization.ownerUserId,
          });
          count += 1;
        }
      }
    }
  }

  return count;
}

async function createPayrollRuns(core: CoreData): Promise<void> {
  for (const property of core.properties) {
    const context = buildContext(core, property);

    for (const window of PAYROLL_WINDOWS.filter((candidate) => candidate.runMode === "finalized" || candidate.runMode === "in_review")) {
      const period = await prisma.payrollPeriod.findUnique({
        where: {
          payrollCalendarId_periodStartDate_periodEndDate: {
            payrollCalendarId: property.payrollSettings[0].payrollCalendarId,
            periodStartDate: parseDateOnly(window.startDate),
            periodEndDate: parseDateOnly(window.endDate),
          },
        },
      });

      if (!period) {
        throw new Error(`Payroll period missing for ${property.name}: ${window.startDate} to ${window.endDate}`);
      }

      const existingNonSeedRun = await prisma.payrollRun.findFirst({
        where: {
          propertyId: property.id,
          payrollPeriodId: period.id,
          OR: [{ notes: null }, { notes: { not: { contains: MARKER } } }],
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (existingNonSeedRun) {
        throw new Error(
          `Refusing to replace non-demo payroll run ${existingNonSeedRun.id} (${existingNonSeedRun.status}) for ${property.name} ${window.startDate} to ${window.endDate}`
        );
      }

      await createPropertyPayrollRun(context, period.id);

      const run = await prisma.payrollRun.findFirstOrThrow({
        where: {
          propertyId: property.id,
          payrollPeriodId: period.id,
        },
        orderBy: {
          version: "desc",
        },
      });

      await prisma.payrollRun.update({
        where: { id: run.id },
        data: {
          notes: `${MARKER} ${window.runMode} demo payroll`,
        },
      });

      const summaries = await prisma.payrollRunEmployeeSummary.findMany({
        where: {
          payrollRunId: run.id,
        },
        select: {
          employeeId: true,
        },
        orderBy: {
          employee: {
            firstName: "asc",
          },
        },
      });

      if (window.runMode === "finalized") {
        for (const summary of summaries) {
          await approvePropertyPayrollEmployee(context, run.id, summary.employeeId, `${MARKER} approved for demo history`);
        }
        await finalizePropertyPayrollRun(context, run.id);
      } else if (summaries[0]) {
        await approvePropertyPayrollEmployee(context, run.id, summaries[0].employeeId, `${MARKER} sample approval`);
      }
    }
  }
}

async function main(): Promise<void> {
  const core = await loadCoreData();

  await cleanupSeededData(core);
  await ensurePropertyAccess(core);
  await ensureEmployeeAssignments(core);
  await ensurePayrollPeriods(core);
  await seedPayRates(core);
  const scheduleShiftCount = await seedSchedules(core);
  const timeShiftCount = await seedTimeSessions(core);
  await createPayrollRuns(core);

  const currentWindowRuns = await prisma.payrollRun.count({
    where: {
      propertyId: { in: core.properties.map((property) => property.id) },
      payrollPeriod: {
        periodStartDate: parseDateOnly("2026-04-26"),
        periodEndDate: parseDateOnly("2026-05-09"),
      },
      notes: { contains: MARKER },
    },
  });

  console.log("Boost Hosp demo seed complete.");
  console.log(`Organization: ${core.organization.name} (${core.organization.slug})`);
  console.log(`Properties: ${core.properties.map((property) => property.name).join(", ")}`);
  console.log(`Employees: ${core.employees.map((employee) => `${employee.firstName} ${employee.lastName}`).join(", ")}`);
  console.log(`Schedule shifts created: ${scheduleShiftCount}`);
  console.log(`Time shifts created: ${timeShiftCount}`);
  console.log("Past payrolls: 2026-03-29..2026-04-11 finalized, 2026-04-12..2026-04-25 in_review");
  console.log(`Current payroll seed runs created: ${currentWindowRuns}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
