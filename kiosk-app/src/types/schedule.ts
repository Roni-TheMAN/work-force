export type SchedulingShiftStatus = "cancelled" | "open" | "scheduled";
export type SchedulingStatus = "draft" | "published";

export type ScheduleShiftEmployee = {
  id: string;
  name: string;
  employmentStatus: string | null;
};

export type ScheduleShift = {
  id: string;
  scheduleId: string;
  date: string;
  startAt: string;
  endAt: string;
  startTime: string;
  endTime: string;
  timeLabel: string;
  breakMinutes: number;
  isOvernight: boolean;
  notes: string | null;
  positionLabel: string | null;
  status: SchedulingShiftStatus;
  employeeId: string | null;
  employeeName: string | null;
  employee: ScheduleShiftEmployee | null;
  updatedAt: string;
};

export type ScheduleDay = {
  date: string;
  isToday: boolean;
  label: string;
  shortLabel: string;
};

export type ScheduleWeek = {
  organizationId: string;
  property: {
    id: string;
    name: string;
    timezone: string;
  };
  scheduleId: string | null;
  status: SchedulingStatus;
  weekStartDate: string;
  weekEndDate: string;
  weekLabel: string;
  publishedAt: string | null;
  publishedBy: {
    displayName: string | null;
    userId: string | null;
  };
  days: ScheduleDay[];
  shifts: ScheduleShift[];
};

export type CachedScheduleWeek = {
  week: ScheduleWeek;
  fetchedAt: string;
};
