import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { assertAllActiveTasksChecked } from "@/lib/domain/checks";
import { writeAuditLog } from "@/lib/domain/audit";
import { loadDutyPeriod } from "@/lib/domain/loaders";
import { conflict, forbidden, handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CompleteDutySchema = z.object({
  dutyPeriodId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = CompleteDutySchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const duty = await loadDutyPeriod(supabase, body.dutyPeriodId);

    if (duty.assignee_id !== user.id && user.role !== "admin") {
      throw forbidden("Only the assignee or admin can complete duty");
    }

    if (!["active", "rejected", "ready_for_recheck"].includes(duty.status)) {
      throw conflict("Duty status does not allow completion");
    }

    await assertAllActiveTasksChecked(supabase, duty.id);

    const { error } = await supabase
      .from("duty_periods")
      .update({
        status: "cleaning_done",
        cleaned_at: new Date().toISOString(),
      })
      .eq("id", duty.id);

    if (error) {
      throw error;
    }

    await writeAuditLog(supabase, {
      actorId: user.id,
      action: "duty_completed",
      entityType: "duty_period",
      entityId: duty.id,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
