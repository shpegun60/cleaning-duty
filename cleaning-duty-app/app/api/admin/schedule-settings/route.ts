import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import {
  assertScheduleIsEmptyForRosterConfig,
  getAppSettings,
  updateAppSettings,
  writeAuditLog,
} from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const ScheduleSettingsSchema = z.object({
  rotationPeriodUnit: z.enum(["day", "week", "month"]),
  rotationPeriodCount: z.number().int().min(1).max(12),
  gracePeriodDays: z.number().int().min(0).max(14).optional(),
  futureScheduleWeeks: z.number().int().min(1).max(52).optional(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = ScheduleSettingsSchema.parse(await request.json());
    const current = await getAppSettings();
    const rosterSettingsChanged =
      body.rotationPeriodUnit !== current.rotation_period_unit ||
      body.rotationPeriodCount !== current.rotation_period_count;

    if (rosterSettingsChanged) {
      await assertScheduleIsEmptyForRosterConfig();
    }

    await updateAppSettings({
      timezone: current.timezone,
      saturdayReminderHour: current.saturday_reminder_hour,
      sundayReminderHour: current.sunday_reminder_hour,
      reminderWindowHours: current.reminder_window_hours,
      futureScheduleWeeks: body.futureScheduleWeeks ?? current.future_schedule_weeks,
      rotationPeriodUnit: body.rotationPeriodUnit,
      rotationPeriodCount: body.rotationPeriodCount,
      gracePeriodDays: body.gracePeriodDays ?? current.grace_period_days,
    });

    await writeAuditLog({
      actorId: admin.id,
      action: "schedule_settings_updated",
      entityType: "app_settings",
      payload: body,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
