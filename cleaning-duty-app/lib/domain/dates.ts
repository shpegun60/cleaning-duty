import { addDays, addMonths, format, parseISO } from "date-fns";

import type { RotationPeriodUnit } from "@/lib/types";

export function addDaysToDateKey(dateKey: string, days: number) {
  return format(addDays(parseISO(dateKey), days), "yyyy-MM-dd");
}

export function nextWeekStartAfter(weekEnd: string) {
  return addDaysToDateKey(weekEnd, 1);
}

export function weekEndFromStart(weekStart: string) {
  return addDaysToDateKey(weekStart, 6);
}

export function addPeriodToDateKey(
  dateKey: string,
  unit: RotationPeriodUnit,
  count: number,
) {
  const date = parseISO(dateKey);

  if (unit === "day") {
    return format(addDays(date, count), "yyyy-MM-dd");
  }

  if (unit === "week") {
    return format(addDays(date, count * 7), "yyyy-MM-dd");
  }

  return format(addMonths(date, count), "yyyy-MM-dd");
}

export function periodEndFromStart(
  periodStart: string,
  unit: RotationPeriodUnit,
  count: number,
) {
  return addDaysToDateKey(addPeriodToDateKey(periodStart, unit, count), -1);
}

export function isMondayDateKey(dateKey: string) {
  return parseISO(dateKey).getDay() === 1;
}
