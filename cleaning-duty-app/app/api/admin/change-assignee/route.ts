import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { readRuntimeConfig } from "@/lib/config/runtime";
import {
  createNotificationIfMissing,
  loadDutyPeriod,
  loadProfile,
  markNotificationFailed,
  markNotificationSent,
  recordAssigneeChange,
  delayScheduledRotationAfterRejectedHandover,
  resolveChangedDutyHandoverTargetAssigneeId,
  syncHandoverLinksAroundDuty,
  writeAuditLog,
} from "@/lib/data/store";
import { adminChangedAssigneeTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import { conflict, handleRouteError } from "@/lib/http";

const ChangeAssigneeSchema = z.object({
  dutyPeriodId: z.string().uuid(),
  newAssigneeId: z.string().uuid(),
  reason: z.string().trim().min(5),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = ChangeAssigneeSchema.parse(await request.json());
    const duty = await loadDutyPeriod(body.dutyPeriodId);

    if (["accepted", "cancelled", "force_closed"].includes(duty.status)) {
      throw conflict("Final duty cannot be reassigned");
    }

    const newAssignee = await loadProfile(body.newAssigneeId);

    if (newAssignee.id === duty.assignee_id) {
      throw conflict("New assignee is already assigned to this duty");
    }

    if (
      newAssignee.role !== "worker" ||
      !newAssignee.is_active ||
      newAssignee.rotation_order === null ||
      newAssignee.rotation_order < 1
    ) {
      throw conflict("New assignee must be an active worker in rotation");
    }

    const nextAssigneeId = await resolveChangedDutyHandoverTargetAssigneeId(
      duty,
      newAssignee.id,
    );
    const change = await recordAssigneeChange({
      duty,
      newAssigneeId: newAssignee.id,
      newNextAssigneeId: nextAssigneeId,
      reason: body.reason,
      adminId: admin.id,
    });
    await syncHandoverLinksAroundDuty(duty.id);
    const updatedDuty = await loadDutyPeriod(duty.id);
    const scheduleRealignment = ["rejected", "ready_for_recheck"].includes(updatedDuty.status)
      ? await delayScheduledRotationAfterRejectedHandover(updatedDuty)
      : null;

    const notification = await createNotificationIfMissing({
      dutyPeriodId: duty.id,
      recipientId: newAssignee.id,
      type: "admin_changed_assignee",
      scheduledFor: new Date(),
    });

    if (notification.created && notification.id) {
      try {
        const template = adminChangedAssigneeTemplate({
          name: newAssignee.full_name,
          dutyUrl: `${readRuntimeConfig().appUrl}/duty/${duty.id}`,
        });
        await sendEmail({ to: newAssignee.email, ...template });
        await markNotificationSent(notification.id);
      } catch (errorCause) {
        await markNotificationFailed(notification.id, errorCause);
      }
    }

    await writeAuditLog({
      actorId: admin.id,
      action: "assignee_changed",
      entityType: "duty_period",
      entityId: duty.id,
      payload: {
        previousAssigneeId: duty.assignee_id,
        newAssigneeId: newAssignee.id,
        nextAssigneeId,
        assigneeChangeId: change.id,
        reason: body.reason,
        scheduleRealignment,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
