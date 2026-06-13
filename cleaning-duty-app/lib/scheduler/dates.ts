import { getDay } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

import { readRuntimeConfig } from "@/lib/config/runtime";

export function getLocalSchedulerState(now = new Date()) {
  const timezone = readRuntimeConfig().appTimezone;
  const zoned = toZonedTime(now, timezone);

  return {
    timezone,
    dateKey: formatInTimeZone(now, timezone, "yyyy-MM-dd"),
    weekday: getDay(zoned),
    hour: Number(formatInTimeZone(now, timezone, "H")),
  };
}

export function isReminderWindow(
  hour: number,
  targetHour: number,
  windowHours: number,
) {
  return hour >= targetHour && hour < targetHour + windowHours;
}
