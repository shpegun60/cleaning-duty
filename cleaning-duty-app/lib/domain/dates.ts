import { addDays, format, parseISO } from "date-fns";

export function addDaysToDateKey(dateKey: string, days: number) {
  return format(addDays(parseISO(dateKey), days), "yyyy-MM-dd");
}

export function nextWeekStartAfter(weekEnd: string) {
  return addDaysToDateKey(weekEnd, 1);
}

export function weekEndFromStart(weekStart: string) {
  return addDaysToDateKey(weekStart, 6);
}

export function isMondayDateKey(dateKey: string) {
  return parseISO(dateKey).getDay() === 1;
}
