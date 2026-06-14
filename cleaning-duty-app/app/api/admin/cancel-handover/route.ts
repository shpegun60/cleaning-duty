import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import {
  clearRoomAcceptancesForDuty,
  listRoomAcceptances,
  loadDutyPeriod,
  revertFutureActiveNextDutyIfPristine,
  statusAfterCleaningCancellation,
  updateDutyPeriod,
  writeAuditLog,
} from "@/lib/data/store";
import { conflict, handleRouteError } from "@/lib/http";
import { getLocalSchedulerState } from "@/lib/scheduler/dates";

const CancelHandoverSchema = z.object({
  dutyPeriodId: z.string().uuid(),
});

const HANDOVER_CANCEL_STATUSES = [
  "handover_pending",
  "accepted",
  "rejected",
  "ready_for_recheck",
] as const;

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = CancelHandoverSchema.parse(await request.json());
    const duty = await loadDutyPeriod(body.dutyPeriodId);
    const acceptances = await listRoomAcceptances(duty.id);
    const localDate = getLocalSchedulerState().dateKey;

    if (
      acceptances.length === 0 &&
      !HANDOVER_CANCEL_STATUSES.includes(duty.status as (typeof HANDOVER_CANCEL_STATUSES)[number])
    ) {
      throw conflict("Duty has no handover state to cancel");
    }

    const nextDutyRollback = await revertFutureActiveNextDutyIfPristine(duty, localDate);
    await clearRoomAcceptancesForDuty(duty.id);
    await updateDutyPeriod(duty.id, {
      status: duty.cleaned_at
        ? "cleaning_done"
        : statusAfterCleaningCancellation(duty, localDate),
      handover_started_at: null,
      accepted_at: null,
      accepted_by: null,
      rejected_at: null,
      rejected_by: null,
      reject_comment: null,
    });

    await writeAuditLog({
      actorId: admin.id,
      action: "handover_cancelled",
      entityType: "duty_period",
      entityId: duty.id,
      payload: {
        previousStatus: duty.status,
        clearedRoomAcceptances: acceptances.length,
        nextDutyRollback,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
