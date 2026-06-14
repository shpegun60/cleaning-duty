import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { addDaysToDateKey, periodEndFromStart } from "@/lib/domain/dates";
import {
  assertAllActiveRoomsAccepted,
  findDutyByWeekStart,
  getAppSettings,
  insertDutyPeriod,
  loadDutyPeriod,
  realignScheduledDutiesAfter,
  resolveNextAssignee,
  updateDutyPeriod,
  writeAuditLog,
} from "@/lib/data/store";
import { conflict, forbidden, handleRouteError } from "@/lib/http";

const AcceptHandoverSchema = z.object({
  dutyPeriodId: z.string().uuid(),
});

const WORKER_HANDOVER_STATUSES = ["cleaning_done", "handover_pending"];
const ADMIN_HANDOVER_STATUSES = [
  "cleaning_done",
  "handover_pending",
  "rejected",
  "ready_for_recheck",
];

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = AcceptHandoverSchema.parse(await request.json());
    const duty = await loadDutyPeriod(body.dutyPeriodId);
    const isAdmin = user.role === "admin";

    if (duty.next_assignee_id !== user.id && !isAdmin) {
      throw forbidden("Only the next assignee can accept handover");
    }

    if (
      (!isAdmin && !WORKER_HANDOVER_STATUSES.includes(duty.status)) ||
      (isAdmin && !ADMIN_HANDOVER_STATUSES.includes(duty.status))
    ) {
      throw conflict("Duty status does not allow handover accept");
    }

    let receivingAssigneeId = duty.next_assignee_id ?? user.id;
    if (isAdmin && !duty.next_assignee_id) {
      receivingAssigneeId = (await resolveNextAssignee(duty.assignee_id)).id;
    }

    await assertAllActiveRoomsAccepted(duty.id);
    await updateDutyPeriod(duty.id, {
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
      rejected_at: null,
      rejected_by: null,
      reject_comment: null,
    });

    const settings = await getAppSettings();
    const nextPeriodStart = addDaysToDateKey(duty.week_end, 1);
    const nextPeriodEnd = periodEndFromStart(
      nextPeriodStart,
      settings.rotation_period_unit,
      settings.rotation_period_count,
    );
    const nextAssignee = await resolveNextAssignee(receivingAssigneeId);
    const existingNext = await findDutyByWeekStart(nextPeriodStart);

    const nextPeriodDutyId: string | null = existingNext?.id ?? null;

    if (existingNext) {
      if (existingNext.status !== "scheduled") {
        throw conflict("Next duty already exists and is not scheduled");
      }

      await updateDutyPeriod(existingNext.id, {
        assignee_id: receivingAssigneeId,
        next_assignee_id: nextAssignee.id,
        status: "active",
      });
    } else {
      await insertDutyPeriod({
        assigneeId: receivingAssigneeId,
        nextAssigneeId: nextAssignee.id,
        weekStart: nextPeriodStart,
        weekEnd: nextPeriodEnd,
        status: "active",
        createdBy: user.id,
      });
    }
    const futureRealignment = await realignScheduledDutiesAfter(
      nextPeriodStart,
      nextAssignee.id,
    );

    await writeAuditLog({
      actorId: user.id,
      action: "handover_accepted",
      entityType: "duty_period",
      entityId: duty.id,
      payload: {
        nextPeriodStart,
        nextPeriodEnd,
        nextPeriodDutyId,
        receivingAssigneeId,
        nextAssigneeId: nextAssignee.id,
        futureRealignment,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
