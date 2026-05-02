require("dotenv").config();

const { PrismaClient } = require("../generated/prisma-rbac");

const prisma = new PrismaClient();

const CANDLEWOOD_PROPERTY_ID = "01232344-76ab-4d9a-9492-4b5960c26d05";
const ORGANIZATION_ID = "23dab8ce-2b45-4587-ac09-0e352a2b1f00";
const CREATED_BY_USER_ID = "b159c3ca-73f5-4397-a686-deb7f17372c3";
const NOTE = "Seeded varied dummy shift for Candlewood current payroll period";

function toUtcFromPacific(localDate, localTime) {
  return new Date(`${localDate}T${localTime}:00-07:00`);
}

function differenceInMinutes(startedAt, endedAt) {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
}

function buildVariations(employeeIdsByName) {
  return [
    {
      employeeId: employeeIdsByName["Roni Patel"],
      shifts: [
        { date: "2026-04-22", start: "08:30", end: "17:10", breakStart: "12:30", breakEnd: "13:05" },
        { date: "2026-04-24", start: "09:00", end: "14:00" },
      ],
    },
    {
      employeeId: employeeIdsByName["Sam BC"],
      shifts: [
        { date: "2026-04-22", start: "14:45", end: "23:15", breakStart: "19:00", breakEnd: "19:20" },
        { date: "2026-04-23", start: "15:30", end: "22:00" },
      ],
    },
    {
      employeeId: employeeIdsByName["Tanya Krochovh"],
      shifts: [
        { date: "2026-04-22", start: "06:45", end: "15:15", breakStart: "11:00", breakEnd: "11:25" },
        { date: "2026-04-24", start: "07:30", end: "12:00" },
        { date: "2026-04-25", start: "08:00", end: "16:00", breakStart: "12:00", breakEnd: "12:30" },
      ],
    },
  ];
}

async function createShift(tx, shift) {
  const businessDate = new Date(`${shift.businessDate}T00:00:00.000Z`);
  const breakMinutes =
    shift.breakStartedAt && shift.breakEndedAt ? differenceInMinutes(shift.breakStartedAt, shift.breakEndedAt) : 0;
  const totalMinutes = differenceInMinutes(shift.startedAt, shift.endedAt);
  const payableMinutes = Math.max(0, totalMinutes - breakMinutes);

  const clockInPunch = await tx.timePunch.create({
    data: {
      organizationId: ORGANIZATION_ID,
      propertyId: CANDLEWOOD_PROPERTY_ID,
      employeeId: shift.employeeId,
      punchType: "clock_in",
      occurredAt: shift.startedAt,
      businessDate,
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
      businessDate,
      entryMode: "manual",
      status: "open",
    },
  });

  if (shift.breakStartedAt && shift.breakEndedAt) {
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
  }

  const clockOutPunch = await tx.timePunch.create({
    data: {
      organizationId: ORGANIZATION_ID,
      propertyId: CANDLEWOOD_PROPERTY_ID,
      employeeId: shift.employeeId,
      punchType: "clock_out",
      occurredAt: shift.endedAt,
      businessDate,
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

  return shiftSession.id;
}

async function main() {
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
  });

  const employeeIdsByName = Object.fromEntries(
    assignments.map((assignment) => [
      `${assignment.employee.firstName} ${assignment.employee.lastName}`.trim(),
      assignment.employee.id,
    ])
  );

  const plannedShifts = buildVariations(employeeIdsByName)
    .flatMap((employee) =>
      employee.shifts.map((shift) => ({
        employeeId: employee.employeeId,
        businessDate: shift.date,
        startedAt: toUtcFromPacific(shift.date, shift.start),
        endedAt: toUtcFromPacific(shift.date, shift.end),
        breakStartedAt: shift.breakStart ? toUtcFromPacific(shift.date, shift.breakStart) : null,
        breakEndedAt: shift.breakEnd ? toUtcFromPacific(shift.date, shift.breakEnd) : null,
      }))
    )
    .filter((shift) => Boolean(shift.employeeId));

  const existingShifts = await prisma.timeShiftSession.findMany({
    where: {
      propertyId: CANDLEWOOD_PROPERTY_ID,
      startedAt: {
        gte: new Date("2026-04-12T00:00:00.000Z"),
        lt: new Date("2026-04-26T00:00:00.000Z"),
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
    console.log("No additional varied Candlewood shifts were needed.");
    return;
  }

  const createdShiftIds = [];

  for (const shift of shiftsToCreate) {
    const shiftId = await prisma.$transaction((tx) => createShift(tx, shift));
    createdShiftIds.push(shiftId);
  }

  console.log(
    JSON.stringify(
      {
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
