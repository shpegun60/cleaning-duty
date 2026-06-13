import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { getAppSettings, updateAppSettings, writeAuditLog } from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const ScheduleSettingsSchema = z.object({
  rotationPeriodUnit: z.enum(["day", "week", "month"]),
  rotationPeriodCount: z.number().int().min(1).max(12),
  futureScheduleWeeks: z.number().int().min(1).max(52),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = ScheduleSettingsSchema.parse(await request.json());
    const current = await getAppSettings();

    await updateAppSettings({
      timezone: current.timezone,
      saturdayReminderHour: current.saturday_reminder_hour,
      sundayReminderHour: current.sunday_reminder_hour,
      reminderWindowHours: current.reminder_window_hours,
      futureScheduleWeeks: body.futureScheduleWeeks,
      rotationPeriodUnit: body.rotationPeriodUnit,
      rotationPeriodCount: body.rotationPeriodCount,
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
