import type { Weekday, WeeklySchedule } from "@/lib/types";

export const WEEKDAYS: Array<{ key: Weekday; short: string; label: string }> = [
  { key: "mon", short: "Mon", label: "Monday" },
  { key: "tue", short: "Tue", label: "Tuesday" },
  { key: "wed", short: "Wed", label: "Wednesday" },
  { key: "thu", short: "Thu", label: "Thursday" },
  { key: "fri", short: "Fri", label: "Friday" },
  { key: "sat", short: "Sat", label: "Saturday" },
  { key: "sun", short: "Sun", label: "Sunday" },
];

export function createDefaultWeeklySchedule(): WeeklySchedule {
  return {
    mon: { enabled: true, arriveBy: "09:00", leaveAt: "18:00" },
    tue: { enabled: true, arriveBy: "09:00", leaveAt: "18:00" },
    wed: { enabled: true, arriveBy: "09:00", leaveAt: "18:00" },
    thu: { enabled: true, arriveBy: "09:00", leaveAt: "18:00" },
    fri: { enabled: true, arriveBy: "09:00", leaveAt: "18:00" },
    sat: { enabled: false, arriveBy: "09:00", leaveAt: "18:00" },
    sun: { enabled: false, arriveBy: "09:00", leaveAt: "18:00" },
  };
}

function minutes(time: string) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

export function getCompatibleDays(
  a: WeeklySchedule,
  b: WeeklySchedule,
  toleranceMinutes = 45,
): Weekday[] {
  return WEEKDAYS.flatMap(({ key }) => {
    const left = a[key];
    const right = b[key];
    if (!left?.enabled || !right?.enabled) return [];

    const arrivalGap = Math.abs(minutes(left.arriveBy) - minutes(right.arriveBy));
    const departureGap = Math.abs(minutes(left.leaveAt) - minutes(right.leaveAt));
    return arrivalGap <= toleranceMinutes && departureGap <= toleranceMinutes ? [key] : [];
  });
}

export function scheduleCompatibilityPercent(a: WeeklySchedule, b: WeeklySchedule) {
  const sharedWorkingDays = WEEKDAYS.filter(({ key }) => a[key]?.enabled && b[key]?.enabled).length;
  if (!sharedWorkingDays) return 0;
  return Math.round((getCompatibleDays(a, b).length / sharedWorkingDays) * 100);
}

export function formatDayList(days: Weekday[]) {
  if (!days.length) return "No compatible days yet";
  return days.map((day) => WEEKDAYS.find((item) => item.key === day)?.short ?? day).join(", ");
}
