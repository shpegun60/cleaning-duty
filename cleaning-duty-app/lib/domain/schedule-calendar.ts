import {
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export function scheduleCalendarRange(month: string) {
  const monthDate = parseISO(`${month}-01`);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  return {
    gridStart: format(startOfWeek(monthStart, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    gridEnd: format(endOfWeek(monthEnd, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

export function currentScheduleMonth() {
  return format(new Date(), "yyyy-MM");
}

export function normalizeScheduleMonth(value: string | string[] | undefined) {
  const month = Array.isArray(value) ? value[0] : value;
  return month && /^\d{4}-\d{2}$/.test(month) ? month : currentScheduleMonth();
}
