import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { assertAllActiveRoomsAccepted } from "@/lib/domain/checks";
import { writeAuditLog } from "@/lib/domain/audit";
import { nextWeekStartAfter, weekEndFromStart } from "@/lib/domain/dates";
import { loadDutyPeriod } from "@/lib/domain/loaders";
import { resolveNextAssignee } from "@/lib/domain/rotation";
import { conflict, forbidden, handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const AcceptHandoverSchema = z.object({
  dutyPeriodId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = AcceptHandoverSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const duty = await loadDutyPeriod(supabase, body.dutyPeriodId);

    if (duty.next_assignee_id !== user.id) {
      throw forbidden("Only the next assignee can accept handover");
    }

    if (!["handover_pending", "ready_for_recheck"].includes(duty.status)) {
      throw conflict("Duty status does not allow handover accept");
    }

    await assertAllActiveRoomsAccepted(supabase, duty.id);

    const { data: acceptedRows, error: acceptError } = await supabase
      .from("duty_periods")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      })
      .eq("id", duty.id)
      .in("status", ["handover_pending", "ready_for_recheck"])
      .select("id");

    if (acceptError) {
      throw acceptError;
    }

    if (!acceptedRows || acceptedRows.length !== 1) {
      throw conflict("Handover was already processed");
    }

    const nextWeekStart = nextWeekStartAfter(duty.week_end);
    const nextWeekEnd = weekEndFromStart(nextWeekStart);
    const nextAssignee = await resolveNextAssignee(supabase, user.id);

    const { data: existingNext, error: existingError } = await supabase
      .from("duty_periods")
      .select("id,status")
      .eq("week_start", nextWeekStart)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingNext) {
      if (existingNext.status !== "scheduled") {
        throw conflict("Next duty already exists and is not scheduled");
      }

      const { error: updateNextError } = await supabase
        .from("duty_periods")
        .update({
          assignee_id: user.id,
          next_assignee_id: nextAssignee.id,
          status: "active",
        })
        .eq("id", existingNext.id);

      if (updateNextError) {
        throw updateNextError;
      }
    } else {
      const { error: insertError } = await supabase.from("duty_periods").insert({
        assignee_id: user.id,
        next_assignee_id: nextAssignee.id,
        week_start: nextWeekStart,
        week_end: nextWeekEnd,
        status: "active",
        created_by: user.id,
      });

      if (insertError) {
        throw insertError;
      }
    }

    await writeAuditLog(supabase, {
      actorId: user.id,
      action: "handover_accepted",
      entityType: "duty_period",
      entityId: duty.id,
      payload: { nextWeekStart, nextAssigneeId: nextAssignee.id },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
