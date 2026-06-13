import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/domain/audit";
import { loadActiveTask, loadDutyPeriod } from "@/lib/domain/loaders";
import { conflict, forbidden, handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TaskCheckSchema = z.object({
  dutyPeriodId: z.string().uuid(),
  taskId: z.string().uuid(),
  isChecked: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = TaskCheckSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const duty = await loadDutyPeriod(supabase, body.dutyPeriodId);

    if (duty.assignee_id !== user.id) {
      throw forbidden("Only the assignee can update task checks");
    }

    if (!["active", "rejected", "ready_for_recheck"].includes(duty.status)) {
      throw conflict("Duty status does not allow task checks");
    }

    await loadActiveTask(supabase, body.taskId);

    const { error } = await supabase.from("task_checks").upsert(
      {
        duty_period_id: body.dutyPeriodId,
        task_id: body.taskId,
        checked_by: user.id,
        is_checked: body.isChecked,
        checked_at: body.isChecked ? new Date().toISOString() : null,
      },
      { onConflict: "duty_period_id,task_id" },
    );

    if (error) {
      throw error;
    }

    await writeAuditLog(supabase, {
      actorId: user.id,
      action: "task_check_updated",
      entityType: "task_check",
      payload: body,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
