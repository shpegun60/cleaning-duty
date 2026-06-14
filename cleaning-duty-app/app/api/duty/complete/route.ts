import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import {
  activateDutyIfCurrentScheduled,
  assertAllActiveTasksChecked,
  isDateWithinDutyPeriod,
  loadDutyPeriod,
  updateDutyPeriod,
  writeAuditLog,
} from "@/lib/data/store";
import { conflict, forbidden, handleRouteError } from "@/lib/http";
import { getLocalSchedulerState } from "@/lib/scheduler/dates";

const CompleteDutySchema = z.object({
  dutyPeriodId: z.string().uuid(),
});

const CLEANING_COMPLETION_STATUSES = ["active", "rejected", "ready_for_recheck"];

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = CompleteDutySchema.parse(await request.json());
    const localDate = getLocalSchedulerState().dateKey;
    const duty = await activateDutyIfCurrentScheduled(
      await loadDutyPeriod(body.dutyPeriodId),
      localDate,
    );
    const isAdmin = user.role === "admin";

    if (duty.assignee_id !== user.id && !isAdmin) {
      throw forbidden("Only the assignee or admin can complete duty");
    }

    if (!isAdmin && !isDateWithinDutyPeriod(duty, localDate)) {
      throw conflict("Duty is outside the assignee date range");
    }

    if (!CLEANING_COMPLETION_STATUSES.includes(duty.status)) {
      throw conflict("Duty status does not allow completion");
    }

    await assertAllActiveTasksChecked(duty.id);
    await updateDutyPeriod(duty.id, {
      status: "cleaning_done",
      cleaned_at: new Date().toISOString(),
    });

    await writeAuditLog({
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
