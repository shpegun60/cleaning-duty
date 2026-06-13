import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { createNotificationIfMissing, markNotificationFailed, markNotificationSent } from "@/lib/domain/notifications";
import { writeAuditLog } from "@/lib/domain/audit";
import { loadDutyPeriod, loadProfile } from "@/lib/domain/loaders";
import { resolveNextAssignee } from "@/lib/domain/rotation";
import { getAppUrl } from "@/lib/env";
import { adminChangedAssigneeTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import { conflict, handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ChangeAssigneeSchema = z.object({
  dutyPeriodId: z.string().uuid(),
  newAssigneeId: z.string().uuid(),
  reason: z.string().trim().min(5),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = ChangeAssigneeSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const duty = await loadDutyPeriod(supabase, body.dutyPeriodId);

    if (["accepted", "cancelled", "force_closed"].includes(duty.status)) {
      throw conflict("Final duty cannot be reassigned");
    }

    const newAssignee = await loadProfile(supabase, body.newAssigneeId);

    if (!newAssignee.is_active) {
      throw conflict("New assignee must be active");
    }

    const nextAssignee = await resolveNextAssignee(supabase, newAssignee.id);
    const { error } = await supabase
      .from("duty_periods")
      .update({
        assignee_id: newAssignee.id,
        next_assignee_id: nextAssignee.id,
      })
      .eq("id", duty.id);

    if (error) {
      throw error;
    }

    const notification = await createNotificationIfMissing({
      supabase,
      dutyPeriodId: duty.id,
      recipientId: newAssignee.id,
      type: "admin_changed_assignee",
      scheduledFor: new Date(),
    });

    if (notification.created && notification.id) {
      try {
        const template = adminChangedAssigneeTemplate({
          name: newAssignee.full_name,
          dutyUrl: `${getAppUrl()}/duty/${duty.id}`,
        });
        await sendEmail({ to: newAssignee.email, ...template });
        await markNotificationSent(supabase, notification.id);
      } catch (errorCause) {
        await markNotificationFailed(supabase, notification.id, errorCause);
      }
    }

    await writeAuditLog(supabase, {
      actorId: admin.id,
      action: "assignee_changed",
      entityType: "duty_period",
      entityId: duty.id,
      payload: {
        previousAssigneeId: duty.assignee_id,
        newAssigneeId: newAssignee.id,
        nextAssigneeId: nextAssignee.id,
        reason: body.reason,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
