import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { readRuntimeConfig } from "@/lib/config/runtime";
import {
  assertAllActiveTasksChecked,
  createNotificationIfMissing,
  loadDutyPeriod,
  loadProfile,
  markNotificationFailed,
  markNotificationSent,
  updateDutyPeriod,
  writeAuditLog,
} from "@/lib/data/store";
import { recheckRequestedTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import { conflict, forbidden, handleRouteError } from "@/lib/http";

const ReadyForRecheckSchema = z.object({
  dutyPeriodId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = ReadyForRecheckSchema.parse(await request.json());
    const duty = await loadDutyPeriod(body.dutyPeriodId);

    if (duty.assignee_id !== user.id) {
      throw forbidden("Only the assignee can request recheck");
    }

    if (duty.status !== "rejected") {
      throw conflict("Only rejected duty can be marked ready for recheck");
    }

    if (!duty.next_assignee_id) {
      throw conflict("Duty has no next assignee");
    }

    await assertAllActiveTasksChecked(duty.id);
    await updateDutyPeriod(duty.id, { status: "ready_for_recheck" });

    const nextAssignee = await loadProfile(duty.next_assignee_id);
    const notification = await createNotificationIfMissing({
      dutyPeriodId: duty.id,
      recipientId: nextAssignee.id,
      type: "recheck_requested",
      scheduledFor: new Date(),
    });

    if (notification.created && notification.id) {
      try {
        const template = recheckRequestedTemplate({
          name: nextAssignee.full_name,
          previousName: user.full_name,
          handoverUrl: `${readRuntimeConfig().appUrl}/handover/${duty.id}`,
        });
        await sendEmail({ to: nextAssignee.email, ...template });
        await markNotificationSent(notification.id);
      } catch (errorCause) {
        await markNotificationFailed(notification.id, errorCause);
      }
    }

    await writeAuditLog({
      actorId: user.id,
      action: "ready_for_recheck",
      entityType: "duty_period",
      entityId: duty.id,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
