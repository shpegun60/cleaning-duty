import { getDay } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

import { getAppTimezone } from "@/lib/env";

export function getLocalSchedulerState(now = new Date()) {
  const timezone = getAppTimezone();
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
