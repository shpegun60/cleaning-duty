import { z } from "zod";

import { readRuntimeConfig, updateRuntimeConfig } from "@/lib/config/runtime";
import { updateLocalAppSettingsDirect, writeLocalAuditLogDirect } from "@/lib/data/store";
import { forbidden, handleRouteError } from "@/lib/http";
import { hasLocalSession } from "@/lib/local/auth";

const SetupConfigSchema = z.object({
  backendMode: z.enum(["local", "supabase"]),
  setupUsername: z.string().trim().min(1),
  setupPassword: z.string(),
  appUrl: z.string().trim().min(1),
  appTimezone: z.string().trim().min(1),
  emailFrom: z.string().trim().min(1),
  supabaseUrl: z.string().trim(),
  supabasePublishableKey: z.string().trim(),
  supabaseSecretKey: z.string(),
  resendApiKey: z.string(),
  cronSecret: z.string(),
  timezone: z.string().trim().min(1),
  saturdayReminderHour: z.number().int().min(0).max(23),
  sundayReminderHour: z.number().int().min(0).max(23),
  reminderWindowHours: z.number().int().min(1).max(6),
  futureScheduleWeeks: z.number().int().min(1).max(52),
  rotationPeriodUnit: z.enum(["day", "week", "month"]),
  rotationPeriodCount: z.number().int().min(1).max(12),
});

export async function POST(request: Request) {
  try {
    if (!(await hasLocalSession())) {
      throw forbidden("Setup login required");
    }

    const body = SetupConfigSchema.parse(await request.json());
    const current = readRuntimeConfig();
    const next = updateRuntimeConfig({
      backendMode: body.backendMode,
      setupUsername: body.setupUsername,
      setupPassword: body.setupPassword || current.setupPassword,
      appUrl: body.appUrl,
      appTimezone: body.appTimezone,
      emailFrom: body.emailFrom,
      supabaseUrl: body.supabaseUrl,
      supabasePublishableKey: body.supabasePublishableKey,
      supabaseSecretKey: body.supabaseSecretKey || current.supabaseSecretKey,
      resendApiKey: body.resendApiKey || current.resendApiKey,
      cronSecret: body.cronSecret || current.cronSecret,
    });

    updateLocalAppSettingsDirect({
      timezone: body.timezone,
      saturdayReminderHour: body.saturdayReminderHour,
      sundayReminderHour: body.sundayReminderHour,
      reminderWindowHours: body.reminderWindowHours,
      futureScheduleWeeks: body.futureScheduleWeeks,
      rotationPeriodUnit: body.rotationPeriodUnit,
      rotationPeriodCount: body.rotationPeriodCount,
    });

    writeLocalAuditLogDirect({
      actorId: "local-admin",
      action: "runtime_config_updated",
      entityType: "runtime_config",
      payload: {
        backendMode: next.backendMode,
        hasSupabaseUrl: Boolean(next.supabaseUrl),
        hasSupabasePublishableKey: Boolean(next.supabasePublishableKey),
        hasSupabaseSecretKey: Boolean(next.supabaseSecretKey),
        hasResendApiKey: Boolean(next.resendApiKey),
        settings: {
          timezone: body.timezone,
          saturdayReminderHour: body.saturdayReminderHour,
          sundayReminderHour: body.sundayReminderHour,
          reminderWindowHours: body.reminderWindowHours,
          futureScheduleWeeks: body.futureScheduleWeeks,
          rotationPeriodUnit: body.rotationPeriodUnit,
          rotationPeriodCount: body.rotationPeriodCount,
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
