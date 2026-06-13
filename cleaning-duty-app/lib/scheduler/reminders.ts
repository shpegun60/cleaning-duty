import type { SupabaseClient } from "@supabase/supabase-js";

import { getAppUrl } from "@/lib/env";
import { writeAuditLog } from "@/lib/domain/audit";
import { createNotificationIfMissing, markNotificationFailed, markNotificationSent } from "@/lib/domain/notifications";
import { resolveNextAssignee } from "@/lib/domain/rotation";
import { sendEmail } from "@/lib/email/send-email";
import { cleaningReminderTemplate, handoverReminderTemplate } from "@/lib/email/templates";
import type { DutyPeriod, Profile } from "@/lib/types";

async function getProfile(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,rotation_order,is_active")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

export async function sendSaturdayCleaningReminderIfNeeded(
  supabase: SupabaseClient,
  localDate: string,
) {
  const { data: duty, error } = await supabase
    .from("duty_periods")
    .select("*")
    .lte("week_start", localDate)
    .gte("week_end", localDate)
    .in("status", ["active", "ready_for_recheck"])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!duty) {
    return false;
  }

  const period = duty as DutyPeriod;
  const assignee = await getProfile(supabase, period.assignee_id);
  const notification = await createNotificationIfMissing({
    supabase,
    dutyPeriodId: period.id,
    recipientId: assignee.id,
    type: "saturday_cleaning_reminder",
    scheduledFor: new Date(),
  });

  if (!notification.created || !notification.id) {
    return false;
  }

  try {
    const template = cleaningReminderTemplate({
      name: assignee.full_name,
      dutyUrl: `${getAppUrl()}/duty/${period.id}`,
    });
    await sendEmail({ to: assignee.email, ...template });
    await markNotificationSent(supabase, notification.id);
    return true;
  } catch (errorCause) {
    await markNotificationFailed(supabase, notification.id, errorCause);
    return false;
  }
}

export async function sendSundayHandoverReminderIfNeeded(
  supabase: SupabaseClient,
  localDate: string,
) {
  const { data: duty, error } = await supabase
    .from("duty_periods")
    .select("*")
    .lte("week_start", localDate)
    .gte("week_end", localDate)
    .in("status", [
      "active",
      "cleaning_done",
      "handover_pending",
      "rejected",
      "ready_for_recheck",
    ])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!duty) {
    return false;
  }

  const period = duty as DutyPeriod;
  let nextAssigneeId = period.next_assignee_id;

  if (nextAssigneeId) {
    const nextProfile = await getProfile(supabase, nextAssigneeId);
    if (!nextProfile.is_active) {
      nextAssigneeId = null;
    }
  }

  if (!nextAssigneeId) {
    const resolved = await resolveNextAssignee(supabase, period.assignee_id);
    nextAssigneeId = resolved.id;
    await supabase
      .from("duty_periods")
      .update({ next_assignee_id: nextAssigneeId })
      .eq("id", period.id);
    await writeAuditLog(supabase, {
      actorId: null,
      action: "scheduler_resolved_next_assignee",
      entityType: "duty_period",
      entityId: period.id,
      payload: { nextAssigneeId },
    });
  }

  if (period.status === "active" || period.status === "cleaning_done") {
    await supabase
      .from("duty_periods")
      .update({
        status: "handover_pending",
        handover_started_at: new Date().toISOString(),
      })
      .eq("id", period.id);
  }

  const assignee = await getProfile(supabase, period.assignee_id);
  const nextAssignee = await getProfile(supabase, nextAssigneeId);
  const notification = await createNotificationIfMissing({
    supabase,
    dutyPeriodId: period.id,
    recipientId: nextAssignee.id,
    type: "sunday_handover_reminder",
    scheduledFor: new Date(),
  });

  if (!notification.created || !notification.id) {
    return false;
  }

  try {
    const template = handoverReminderTemplate({
      name: nextAssignee.full_name,
      previousName: assignee.full_name,
      handoverUrl: `${getAppUrl()}/handover/${period.id}`,
    });
    await sendEmail({ to: nextAssignee.email, ...template });
    await markNotificationSent(supabase, notification.id);
    return true;
  } catch (errorCause) {
    await markNotificationFailed(supabase, notification.id, errorCause);
    return false;
  }
}
