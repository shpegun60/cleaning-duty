import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import {
  clearRoomAcceptancesForDuty,
  clearTaskChecksForDuty,
  getAppSettings,
  loadDutyPeriod,
  revertFutureActiveNextDutyIfPristine,
  restoreScheduledRotationAfterCancelledHandover,
  statusAfterCleaningCancellation,
  updateDutyPeriod,
  writeAuditLog,
} from "@/lib/data/store";
import { conflict, handleRouteError } from "@/lib/http";
import { getLocalSchedulerState } from "@/lib/scheduler/dates";

const CancelCleaningSchema = z.object({
  dutyPeriodId: z.string().uuid(),
});

const CLEANING_CANCEL_STATUSES = [
  "cleaning_done",
  "handover_pending",
  "accepted",
  "rejected",
  "ready_for_recheck",
] as const;

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = CancelCleaningSchema.parse(await request.json());
    const duty = await loadDutyPeriod(body.dutyPeriodId);
    const localDate = getLocalSchedulerState().dateKey;
    const settings = await getAppSettings();

    if (!CLEANING_CANCEL_STATUSES.includes(duty.status as (typeof CLEANING_CANCEL_STATUSES)[number])) {
      throw conflict("Duty status does not allow cleaning cancellation");
    }

    const nextDutyRollback = await revertFutureActiveNextDutyIfPristine(duty, localDate);
    const scheduleRestore = ["rejected", "ready_for_recheck"].includes(duty.status)
      ? await restoreScheduledRotationAfterCancelledHandover(duty)
      : null;
    await clearRoomAcceptancesForDuty(duty.id);
    await clearTaskChecksForDuty(duty.id);
    await updateDutyPeriod(duty.id, {
      status: statusAfterCleaningCancellation(
        duty,
        localDate,
        settings.grace_period_days,
      ),
      cleaned_at: null,
      handover_started_at: null,
      accepted_at: null,
      accepted_by: null,
      rejected_at: null,
      rejected_by: null,
      reject_comment: null,
    });

    await writeAuditLog({
      actorId: admin.id,
      action: "cleaning_cancelled",
      entityType: "duty_period",
      entityId: duty.id,
      payload: {
        previousStatus: duty.status,
        nextDutyRollback,
        scheduleRestore,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
