import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { createNotificationIfMissing, markNotificationFailed, markNotificationSent } from "@/lib/domain/notifications";
import { writeAuditLog } from "@/lib/domain/audit";
import { loadActiveRoom, loadDutyPeriod, loadProfile } from "@/lib/domain/loaders";
import { getAppUrl } from "@/lib/env";
import { handoverRejectedTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import { conflict, forbidden, handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const RejectHandoverSchema = z.object({
  dutyPeriodId: z.string().uuid(),
  rejectedRoomIds: z.array(z.string().uuid()).min(1),
  comment: z.string().trim().min(5),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = RejectHandoverSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const duty = await loadDutyPeriod(supabase, body.dutyPeriodId);

    if (duty.next_assignee_id !== user.id) {
      throw forbidden("Only the next assignee can reject handover");
    }

    if (!["handover_pending", "ready_for_recheck"].includes(duty.status)) {
      throw conflict("Duty status does not allow rejection");
    }

    for (const roomId of body.rejectedRoomIds) {
      await loadActiveRoom(supabase, roomId);
    }

    const now = new Date().toISOString();
    const rows = body.rejectedRoomIds.map((roomId) => ({
      duty_period_id: duty.id,
      room_id: roomId,
      accepted_by: user.id,
      status: "rejected",
      checked_at: now,
      comment: body.comment,
    }));

    const { error: roomError } = await supabase
      .from("room_acceptances")
      .upsert(rows, { onConflict: "duty_period_id,room_id" });

    if (roomError) {
      throw roomError;
    }

    const { error: dutyError } = await supabase
      .from("duty_periods")
      .update({
        status: "rejected",
        rejected_by: user.id,
        rejected_at: now,
        reject_comment: body.comment,
      })
      .eq("id", duty.id);

    if (dutyError) {
      throw dutyError;
    }

    const assignee = await loadProfile(supabase, duty.assignee_id);
    const notification = await createNotificationIfMissing({
      supabase,
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
          dutyUrl: `${getAppUrl()}/duty/${duty.id}`,
        });
        await sendEmail({ to: assignee.email, ...template });
        await markNotificationSent(supabase, notification.id);
      } catch (errorCause) {
        await markNotificationFailed(supabase, notification.id, errorCause);
      }
    }

    await writeAuditLog(supabase, {
      actorId: user.id,
      action: "handover_rejected",
      entityType: "duty_period",
      entityId: duty.id,
      payload: body,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
