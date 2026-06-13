import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationType } from "@/lib/types";

export async function createNotificationIfMissing(params: {
  supabase: SupabaseClient;
  dutyPeriodId: string | null;
  recipientId: string;
  type: NotificationType;
  scheduledFor: Date;
}) {
  const { data, error } = await params.supabase
    .from("notifications")
    .insert({
      duty_period_id: params.dutyPeriodId,
      recipient_id: params.recipientId,
      type: params.type,
      status: "pending",
      scheduled_for: params.scheduledFor.toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { created: false, id: null };
    }

    throw error;
  }

  return { created: true, id: data.id as string };
}

export async function markNotificationSent(
  supabase: SupabaseClient,
  notificationId: string,
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({
      status: "sent",
      sent_at: now,
      last_attempt_at: now,
      attempt_count: 1,
      error_message: null,
    })
    .eq("id", notificationId);

  if (error) {
    throw error;
  }
}

export async function markNotificationFailed(
  supabase: SupabaseClient,
  notificationId: string,
  cause: unknown,
) {
  const message = cause instanceof Error ? cause.message : "Unknown email error";
  const { data: existing } = await supabase
    .from("notifications")
    .select("attempt_count")
    .eq("id", notificationId)
    .single();

  const { error } = await supabase
    .from("notifications")
    .update({
      status: "failed",
      last_attempt_at: new Date().toISOString(),
      attempt_count: Number(existing?.attempt_count ?? 0) + 1,
      error_message: message,
    })
    .eq("id", notificationId);

  if (error) {
    throw error;
  }
}
