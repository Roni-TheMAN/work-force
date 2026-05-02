require("dotenv").config();

const { PrismaClient } = require("../generated/prisma-rbac");

const prisma = new PrismaClient();

const CANDLEWOOD_PROPERTY_ID = "01232344-76ab-4d9a-9492-4b5960c26d05";
const ORGANIZATION_ID = "23dab8ce-2b45-4587-ac09-0e352a2b1f00";
const PAYROLL_PERIOD_START = "2026-04-12";
const PAYROLL_PERIOD_END_EXCLUSIVE = "2026-04-26";
const CREATED_BY_USER_ID = "b159c3ca-73f5-4397-a686-deb7f17372c3";
const NOTE = "Seeded dummy shift for Candlewood current payroll period";

function toUtcFromPacific(localDate, localTime) {
  return new Date(`${localDate}T${localTime}:00-07:00`);
}

function differenceInMinutes(startedAt, endedAt) {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
}

function buildShiftDefinitions(employeeIdsByName) {
  return [
    {
      employeeId: employeeIdsByName["Roni Patel"],
      shifts: [
        { date: "2026-04-13", start: "08:00", end: "16:30", breakStart: "12:00", breakEnd: "12:30" },
        { date: "2026-04-14", start: "08:15", end: "16:45", breakStart: "12:15", breakEnd: "12:45" },
        { date: "2026-04-15", start: "08:00", end: "16:30", breakStart: "12:05", breakEnd: "12:35" },
        { date: "2026-04-16", start: "07:50", end: "16:20", breakStart: "12:00", breakEnd: "12:30" },
        { date: "2026-04-17", start: "08:05", end: "16:35", breakStart: "12:10", breakEnd: "12:40" },
      ],
    },
    {
      employeeId: employeeIdsByName["Sam BC"],
      shifts: [
        { date: "2026-04-13", start: "15:00", end: "23:30", breakStart: "19:00", breakEnd: "19:30" },
        { date: "2026-04-14", start: "15:10", end: "23:40", breakStart: "19:05", breakEnd: "19:35" },
        { date: "2026-04-15", start: "14:55", end: "23:25", breakStart: "18:55", breakEnd: "19:25" },
        { date: "2026-04-16", start: "15:00", end: "23:30", breakStart: "19:10", breakEnd: "19:40" },
        { date: "2026-04-17", start: "15:05", end: "23:35", breakStart: "19:00", breakEnd: "19:30" },
      ],
    },
    {
      employeeId: employeeIdsByName["Tanya Krochovh"],
      shifts: [
        { date: "2026-04-13", start: "07:00", end: "15:30", breakStart: "11:00", breakEnd: "11:30" },
        { date: "2026-04-14", start: "07:10", end: "15:40", breakStart: "11:10", breakEnd: "11:40" },
        { date: "2026-04-15", start: "07:00", end: "15:30", breakStart: "11:05", breakEnd: "11:35" },
        { date: "2026-04-16", start: "06:55", end: "15:25", breakStart: "11:00", breakEnd: "11:30" },
        { date: "2026-04-17", start: "07:05", end: "15:35", breakStart: "11:15", breakEnd: "11:45" },
      ],
    },
  ];
}

async function main() {
  const property = await prisma.property.findUnique({
    where: { id: CANDLEWOOD_PROPERTY_ID },
    select: {
      id: true,
      name: true,
      organizationId: true,
      timezone: true,
    },
  });

  if (!property) {
    throw new Error("Candlewood property not found.");
  }

  const payrollSetting = await prisma.propertyPayrollSetting.findFirst({
    where: {
      propertyId: CANDLEWOOD_PROPERTY_ID,
      effectiveTo: null,
    },
    include: {
      payrollCalendar: true,
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  });

  if (!payrollSetting) {
    throw new Error("No active payroll setting found for Candlewood.");
  }

  const currentPeriod = await prisma.payrollPeriod.findFirst({
    where: {
      payrollCalendarId: payrollSetting.payrollCalendarId,
      periodStartDate: new Date(`${PAYROLL_PERIOD_START}T00:00:00.000Z`),
      periodEndDate: new Date("2026-04-25T00:00:00.000Z"),
    },
    select: {
      id: true,
      periodStartDate: true,
      periodEndDate: true,
      status: true,
    },
  });

  if (!currentPeriod) {
    throw new Error("Apr 12 - Apr 25 payroll period was not found for Candlewood.");
  }

  const assignments = await prisma.employeePropertyAssignment.findMany({
    where: {
      propertyId: CANDLEWOOD_PROPERTY_ID,
      activeTo: null,
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const employeeIdsByName = Object.fromEntries(
    assignments.map((assignment) => [
      `${assignment.employee.firstName} ${assignment.employee.lastName}`.trim(),
      assignment.employee.id,
    ])
  );

  for (const requiredName of ["Roni Patel", "Sam BC", "Tanya Krochovh"]) {
    if (!employeeIdsByName[requiredName]) {
      throw new Error(`Expected assigned employee ${requiredName} was not found on Candlewood.`);
    }
  }

  const plannedShifts = buildShiftDefinitions(employeeIdsByName)
    .flatMap((employee) =>
      employee.shifts.map((shift) => ({
        employeeId: employee.employeeId,
        businessDate: shift.date,
        startedAt: toUtcFromPacific(shift.date, shift.start),
        endedAt: toUtcFromPacific(shift.date, shift.end),
        breakStartedAt: toUtcFromPacific(shift.date, shift.breakStart),
        breakEndedAt: toUtcFromPacific(shift.date, shift.breakEnd),
      }))
    )
    .filter((shift) => Boolean(shift.employeeId));

  const existingShifts = await prisma.timeShiftSession.findMany({
    where: {
      propertyId: CANDLEWOOD_PROPERTY_ID,
      startedAt: {
        gte: new Date(`${PAYROLL_PERIOD_START}T00:00:00.000Z`),
        lt: new Date(`${PAYROLL_PERIOD_END_EXCLUSIVE}T00:00:00.000Z`),
      },
    },
    select: {
      employeeId: true,
      businessDate: true,
    },
  });

  const existingKeys = new Set(
    existingShifts.map((shift) => `${shift.employeeId}:${shift.businessDate.toISOString().slice(0, 10)}`)
  );

  const shiftsToCreate = plannedShifts.filter(
    (shift) => !existingKeys.has(`${shift.employeeId}:${shift.businessDate}`)
  );

  if (shiftsToCreate.length === 0) {
    console.log("No missing Candlewood dummy shifts were found for Apr 12 - Apr 25.");
    return;
  }

  const createdShiftIds = [];

  for (const shift of shiftsToCreate) {
    const breakMinutes = differenceInMinutes(shift.breakStartedAt, shift.breakEndedAt);
    const totalMinutes = differenceInMinutes(shift.startedAt, shift.endedAt);
    const payableMinutes = Math.max(0, totalMinutes - breakMinutes);

    await prisma.$transaction(async (tx) => {
      const clockInPunch = await tx.timePunch.create({
        data: {
          organizationId: ORGANIZATION_ID,
          propertyId: CANDLEWOOD_PROPERTY_ID,
          employeeId: shift.employeeId,
          punchType: "clock_in",
          occurredAt: shift.startedAt,
          businessDate: new Date(`${shift.businessDate}T00:00:00.000Z`),
          source: "manual",
          note: NOTE,
          status: "valid",
          createdByUserId: CREATED_BY_USER_ID,
        },
      });

      const shiftSession = await tx.timeShiftSession.create({
        data: {
          organizationId: ORGANIZATION_ID,
          propertyId: CANDLEWOOD_PROPERTY_ID,
          employeeId: shift.employeeId,
          clockInPunchId: clockInPunch.id,
          startedAt: shift.startedAt,
          businessDate: new Date(`${shift.businessDate}T00:00:00.000Z`),
          entryMode: "manual",
          status: "open",
        },
      });

      await tx.shiftBreakSegment.create({
        data: {
          shiftSessionId: shiftSession.id,
          breakType: "meal",
          paid: false,
          startedAt: shift.breakStartedAt,
          endedAt: shift.breakEndedAt,
          durationMinutes: breakMinutes,
          source: "manual",
        },
      });

      const clockOutPunch = await tx.timePunch.create({
        data: {
          organizationId: ORGANIZATION_ID,
          propertyId: CANDLEWOOD_PROPERTY_ID,
          employeeId: shift.employeeId,
          punchType: "clock_out",
          occurredAt: shift.endedAt,
          businessDate: new Date(`${shift.businessDate}T00:00:00.000Z`),
          source: "manual",
          note: NOTE,
          status: "valid",
          createdByUserId: CREATED_BY_USER_ID,
        },
      });

      await tx.timeShiftSession.update({
        where: {
          id: shiftSession.id,
        },
        data: {
          clockOutPunchId: clockOutPunch.id,
          endedAt: shift.endedAt,
          status: "closed",
          totalMinutes,
          breakMinutes,
          payableMinutes,
        },
      });

      createdShiftIds.push(shiftSession.id);
    });
  }

  console.log(
    JSON.stringify(
      {
        property: {
          id: property.id,
          name: property.name,
          timezone: property.timezone,
        },
        payrollPeriod: {
          id: currentPeriod.id,
          status: currentPeriod.status,
          periodStartDate: currentPeriod.periodStartDate.toISOString().slice(0, 10),
          periodEndDate: currentPeriod.periodEndDate.toISOString().slice(0, 10),
        },
        createdShiftCount: createdShiftIds.length,
        createdShiftIds,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
