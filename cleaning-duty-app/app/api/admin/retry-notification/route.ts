import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { readRuntimeConfig } from "@/lib/config/runtime";
import {
  loadDutyPeriod,
  loadNotification,
  loadProfile,
  markNotificationFailed,
  markNotificationSent,
  writeAuditLog,
} from "@/lib/data/store";
import { adminChangedAssigneeTemplate, cleaningReminderTemplate, handoverRejectedTemplate, handoverReminderTemplate, recheckRequestedTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import { badRequest, conflict, handleRouteError, notFound } from "@/lib/http";

const RetryNotificationSchema = z.object({
  notificationId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = RetryNotificationSchema.parse(await request.json());
    let notification;
    try {
      notification = await loadNotification(body.notificationId);
    } catch {
      throw notFound("Notification not found");
    }

    if (notification.status !== "failed") {
      throw conflict("Only failed notifications can be retried");
    }

    const recipient = await loadProfile(notification.recipient_id);
    const duty = notification.duty_period_id
      ? await loadDutyPeriod(notification.duty_period_id)
      : null;

    if (!duty) {
      throw badRequest("Notification has no duty period");
    }

    let template: { subject: string; html: string };

    if (notification.type === "saturday_cleaning_reminder") {
      template = cleaningReminderTemplate({
        name: recipient.full_name,
        dutyUrl: `${readRuntimeConfig().appUrl}/duty/${duty.id}`,
      });
    } else if (notification.type === "sunday_handover_reminder") {
      const previous = await loadProfile(duty.assignee_id);
      template = handoverReminderTemplate({
        name: recipient.full_name,
        previousName: previous.full_name,
        handoverUrl: `${readRuntimeConfig().appUrl}/handover/${duty.id}`,
      });
    } else if (notification.type === "handover_rejected") {
      template = handoverRejectedTemplate({
        name: recipient.full_name,
        comment: duty.reject_comment ?? "Без коментаря",
        dutyUrl: `${readRuntimeConfig().appUrl}/duty/${duty.id}`,
      });
    } else if (notification.type === "recheck_requested") {
      const previous = await loadProfile(duty.assignee_id);
      template = recheckRequestedTemplate({
        name: recipient.full_name,
        previousName: previous.full_name,
        handoverUrl: `${readRuntimeConfig().appUrl}/handover/${duty.id}`,
      });
    } else if (notification.type === "admin_changed_assignee") {
      template = adminChangedAssigneeTemplate({
        name: recipient.full_name,
        dutyUrl: `${readRuntimeConfig().appUrl}/duty/${duty.id}`,
      });
    } else {
      throw badRequest("Unsupported notification type for retry");
    }

    try {
      await sendEmail({ to: recipient.email, ...template });
      await markNotificationSent(notification.id);
    } catch (errorCause) {
      await markNotificationFailed(notification.id, errorCause);
      throw errorCause;
    }

    await writeAuditLog({
      actorId: admin.id,
      action: "notification_retried",
      entityType: "notification",
      entityId: notification.id,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
