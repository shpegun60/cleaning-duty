import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { assertAllActiveTasksChecked } from "@/lib/domain/checks";
import { createNotificationIfMissing, markNotificationFailed, markNotificationSent } from "@/lib/domain/notifications";
import { writeAuditLog } from "@/lib/domain/audit";
import { loadDutyPeriod, loadProfile } from "@/lib/domain/loaders";
import { getAppUrl } from "@/lib/env";
import { recheckRequestedTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import { conflict, forbidden, handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ReadyForRecheckSchema = z.object({
  dutyPeriodId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = ReadyForRecheckSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const duty = await loadDutyPeriod(supabase, body.dutyPeriodId);

    if (duty.assignee_id !== user.id) {
      throw forbidden("Only the assignee can request recheck");
    }

    if (duty.status !== "rejected") {
      throw conflict("Only rejected duty can be marked ready for recheck");
    }

    if (!duty.next_assignee_id) {
      throw conflict("Duty has no next assignee");
    }

    await assertAllActiveTasksChecked(supabase, duty.id);

    const { error } = await supabase
      .from("duty_periods")
      .update({ status: "ready_for_recheck" })
      .eq("id", duty.id);

    if (error) {
      throw error;
    }

    const nextAssignee = await loadProfile(supabase, duty.next_assignee_id);
    const notification = await createNotificationIfMissing({
      supabase,
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
          handoverUrl: `${getAppUrl()}/handover/${duty.id}`,
        });
        await sendEmail({ to: nextAssignee.email, ...template });
        await markNotificationSent(supabase, notification.id);
      } catch (errorCause) {
        await markNotificationFailed(supabase, notification.id, errorCause);
      }
    }

    await writeAuditLog(supabase, {
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
