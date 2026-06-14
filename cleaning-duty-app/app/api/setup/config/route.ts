import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { readRuntimeConfig, updateRuntimeConfig } from "@/lib/config/runtime";
import { writeLocalAuditLogDirect } from "@/lib/data/store";
import { forbidden, handleRouteError } from "@/lib/http";
import { hasLocalAdminSession } from "@/lib/local/auth";

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
});

export async function POST(request: Request) {
  try {
    const actorId = await resolveSetupActorId();

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

    writeLocalAuditLogDirect({
      actorId,
      action: "runtime_config_updated",
      entityType: "runtime_config",
      payload: {
        backendMode: next.backendMode,
        hasSupabaseUrl: Boolean(next.supabaseUrl),
        hasSupabasePublishableKey: Boolean(next.supabasePublishableKey),
        hasSupabaseSecretKey: Boolean(next.supabaseSecretKey),
        hasResendApiKey: Boolean(next.resendApiKey),
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function resolveSetupActorId() {
  if (await hasLocalAdminSession()) {
    return "local-admin";
  }

  const admin = await requireAdmin().catch(() => null);

  if (admin) {
    return admin.id;
  }

  throw forbidden("Setup admin login required");
}
