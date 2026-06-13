import { randomUUID } from "crypto";

import { activateScheduledDutiesForDate, isLocalBackend } from "@/lib/data/store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLocalSchedulerState, isReminderWindow } from "@/lib/scheduler/dates";
import {
  sendSaturdayCleaningReminderIfNeeded,
  sendSundayHandoverReminderIfNeeded,
} from "@/lib/scheduler/reminders";

const SATURDAY = 6;
const SUNDAY = 0;

export async function runScheduler() {
  const local = getLocalSchedulerState();

  if (isLocalBackend()) {
    const activatedDutyPeriods = await activateScheduledDutiesForDate(local.dateKey);
    return {
      skipped: true,
      reason: "local_backend_scheduler_email_disabled",
      localDate: local.dateKey,
      localHour: local.hour,
      activatedDutyPeriods: activatedDutyPeriods.length,
    };
  }

  const supabase = createSupabaseAdminClient();
  const owner = randomUUID();

  const { data: lockAcquired, error: lockError } = await supabase.rpc(
    "try_acquire_cron_lock",
    {
      p_lock_name: "main_scheduler",
      p_owner: owner,
      p_ttl_seconds: 600,
    },
  );

  if (lockError) {
    throw lockError;
  }

  if (!lockAcquired) {
    return { skipped: true, reason: "scheduler_lock_not_acquired" };
  }

  try {
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select(
        "saturday_reminder_hour,sunday_reminder_hour,reminder_window_hours",
      )
      .eq("id", true)
      .single();

    if (settingsError) {
      throw settingsError;
    }

    const activatedDutyPeriods = await activateScheduledDutiesForDate(local.dateKey);
    const result = {
      localDate: local.dateKey,
      localHour: local.hour,
      activatedDutyPeriods: activatedDutyPeriods.length,
      saturdayCleaningReminder: false,
      sundayHandoverReminder: false,
    };

    if (
      local.weekday === SATURDAY &&
      isReminderWindow(
        local.hour,
        settings.saturday_reminder_hour,
        settings.reminder_window_hours,
      )
    ) {
      result.saturdayCleaningReminder =
        await sendSaturdayCleaningReminderIfNeeded(supabase, local.dateKey);
    }

    if (
      local.weekday === SUNDAY &&
      isReminderWindow(
        local.hour,
        settings.sunday_reminder_hour,
        settings.reminder_window_hours,
      )
    ) {
      result.sundayHandoverReminder =
        await sendSundayHandoverReminderIfNeeded(supabase, local.dateKey);
    }

    return result;
  } finally {
    await supabase.rpc("release_cron_lock", {
      p_lock_name: "main_scheduler",
      p_owner: owner,
    });
  }
}
