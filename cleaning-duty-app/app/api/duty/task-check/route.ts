import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import {
  activateDutyIfCurrentScheduled,
  loadActiveTask,
  loadDutyPeriod,
  upsertTaskCheck,
  writeAuditLog,
} from "@/lib/data/store";
import { conflict, forbidden, handleRouteError } from "@/lib/http";
import { getLocalSchedulerState } from "@/lib/scheduler/dates";

const TaskCheckSchema = z.object({
  dutyPeriodId: z.string().uuid(),
  taskId: z.string().uuid(),
  isChecked: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = TaskCheckSchema.parse(await request.json());
    const duty = await activateDutyIfCurrentScheduled(
      await loadDutyPeriod(body.dutyPeriodId),
      getLocalSchedulerState().dateKey,
    );

    if (duty.assignee_id !== user.id) {
      throw forbidden("Only the assignee can update task checks");
    }

    if (!["active", "rejected", "ready_for_recheck"].includes(duty.status)) {
      throw conflict("Duty status does not allow task checks");
    }

    await loadActiveTask(body.taskId);
    await upsertTaskCheck({
      dutyPeriodId: body.dutyPeriodId,
      taskId: body.taskId,
      checkedBy: user.id,
      isChecked: body.isChecked,
    });

    await writeAuditLog({
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
