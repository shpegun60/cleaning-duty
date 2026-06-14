import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { readRuntimeConfig } from "@/lib/config/runtime";
import {
  createNotificationIfMissing,
  delayScheduledRotationAfterRejectedHandover,
  loadActiveRoom,
  loadDutyPeriod,
  loadProfile,
  markNotificationFailed,
  markNotificationSent,
  updateDutyPeriod,
  upsertRoomAcceptance,
  writeAuditLog,
} from "@/lib/data/store";
import { handoverRejectedTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import { conflict, forbidden, handleRouteError } from "@/lib/http";

const RejectHandoverSchema = z.object({
  dutyPeriodId: z.string().uuid(),
  rejectedRoomIds: z.array(z.string().trim().min(1)).min(1),
  comment: z.string().trim().min(5),
});

const WORKER_HANDOVER_STATUSES = ["cleaning_done", "handover_pending", "ready_for_recheck"];
const ADMIN_HANDOVER_STATUSES = [
  "cleaning_done",
  "handover_pending",
  "ready_for_recheck",
];

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = RejectHandoverSchema.parse(await request.json());
    const duty = await loadDutyPeriod(body.dutyPeriodId);
    const isAdmin = user.role === "admin";

    if (duty.next_assignee_id !== user.id && !isAdmin) {
      throw forbidden("Only the next assignee can reject handover");
    }

    if (duty.status === "rejected") {
      throw conflict("Duty is already rejected. Wait for recheck or cancel handover.");
    }

    if (
      (!isAdmin && !WORKER_HANDOVER_STATUSES.includes(duty.status)) ||
      (isAdmin && !ADMIN_HANDOVER_STATUSES.includes(duty.status))
    ) {
      throw conflict("Duty status does not allow rejection");
    }

    for (const roomId of body.rejectedRoomIds) {
      await loadActiveRoom(roomId);
    }

    const now = new Date().toISOString();
    for (const roomId of body.rejectedRoomIds) {
      await upsertRoomAcceptance({
        dutyPeriodId: duty.id,
        roomId,
        acceptedBy: user.id,
        status: "rejected",
        comment: body.comment,
      });
    }

    await updateDutyPeriod(duty.id, {
      status: "rejected",
      handover_started_at: duty.handover_started_at ?? now,
      rejected_by: user.id,
      rejected_at: now,
      reject_comment: body.comment,
    });
    const scheduleShift = await delayScheduledRotationAfterRejectedHandover(duty);

    const assignee = await loadProfile(duty.assignee_id);
    const notification = await createNotificationIfMissing({
      dutyPeriodId: duty.id,
      recipientId: assignee.id,
      type: "handover_rejected",
      scheduledFor: new Date(),
    });

    if (notification.created && notification.id) {
      try {
        const template = handoverRejectedTemplate({
          name: assignee.full_name,
          comment: body.comment,
          dutyUrl: `${readRuntimeConfig().appUrl}/duty/${duty.id}`,
        });
        await sendEmail({ to: assignee.email, ...template });
        await markNotificationSent(notification.id);
      } catch (errorCause) {
        await markNotificationFailed(notification.id, errorCause);
      }
    }

    await writeAuditLog({
      actorId: user.id,
      action: "handover_rejected",
      entityType: "duty_period",
      entityId: duty.id,
      payload: {
        ...body,
        scheduleShift,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
