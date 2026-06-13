import {
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

const MAX_CUSTOM_RANGE_DAYS = 366;

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

export function normalizeScheduleDate(value: string | string[] | undefined) {
  const date = Array.isArray(value) ? value[0] : value;
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export function scheduleViewRange(params: {
  month?: string | string[];
  start?: string | string[];
  end?: string | string[];
}) {
  const month = normalizeScheduleMonth(params.month);
  const start = normalizeScheduleDate(params.start);
  const end = normalizeScheduleDate(params.end);

  if (start && end && end >= start) {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    const days = differenceInCalendarDays(endDate, startDate) + 1;

    if (days <= MAX_CUSTOM_RANGE_DAYS) {
      return {
        mode: "range" as const,
        month,
        start,
        end,
        gridStart: format(startOfWeek(startDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        gridEnd: format(endOfWeek(endDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
  }

  const monthDate = parseISO(`${month}-01`);
  return {
    mode: "month" as const,
    month,
    start: format(startOfMonth(monthDate), "yyyy-MM-dd"),
    end: format(endOfMonth(monthDate), "yyyy-MM-dd"),
    ...scheduleCalendarRange(month),
  };
}
