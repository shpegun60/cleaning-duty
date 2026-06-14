import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import {
  activateDutyIfCurrentScheduled,
  isDateWithinDutyPeriod,
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

const WORKER_TASK_CHECK_STATUSES = ["active"];
const ADMIN_TASK_CHECK_STATUSES = [
  "scheduled",
  "active",
  "cleaning_done",
  "handover_pending",
  "rejected",
  "ready_for_recheck",
];

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = TaskCheckSchema.parse(await request.json());
    const localDate = getLocalSchedulerState().dateKey;
    const duty = await activateDutyIfCurrentScheduled(
      await loadDutyPeriod(body.dutyPeriodId),
      localDate,
    );
    const isAdmin = user.role === "admin";

    if (duty.assignee_id !== user.id && !isAdmin) {
      throw forbidden("Only the assignee can update task checks");
    }

    if (!isAdmin && !isDateWithinDutyPeriod(duty, localDate)) {
      throw conflict("Duty is outside the assignee date range");
    }

    if (
      (!isAdmin && !WORKER_TASK_CHECK_STATUSES.includes(duty.status)) ||
      (isAdmin && !ADMIN_TASK_CHECK_STATUSES.includes(duty.status))
    ) {
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
