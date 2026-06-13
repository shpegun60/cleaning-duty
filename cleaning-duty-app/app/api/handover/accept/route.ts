import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { addDaysToDateKey, periodEndFromStart } from "@/lib/domain/dates";
import {
  assertAllActiveRoomsAccepted,
  findDutyByWeekStart,
  getAppSettings,
  insertDutyPeriod,
  loadDutyPeriod,
  resolveNextAssignee,
  updateDutyPeriod,
  writeAuditLog,
} from "@/lib/data/store";
import { conflict, forbidden, handleRouteError } from "@/lib/http";

const AcceptHandoverSchema = z.object({
  dutyPeriodId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = AcceptHandoverSchema.parse(await request.json());
    const duty = await loadDutyPeriod(body.dutyPeriodId);

    if (duty.next_assignee_id !== user.id) {
      throw forbidden("Only the next assignee can accept handover");
    }

    if (!["handover_pending", "ready_for_recheck"].includes(duty.status)) {
      throw conflict("Duty status does not allow handover accept");
    }

    await assertAllActiveRoomsAccepted(duty.id);
    await updateDutyPeriod(duty.id, {
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
    });

    const settings = await getAppSettings();
    const nextPeriodStart = addDaysToDateKey(duty.week_end, 1);
    const nextPeriodEnd = periodEndFromStart(
      nextPeriodStart,
      settings.rotation_period_unit,
      settings.rotation_period_count,
    );
    const nextAssignee = await resolveNextAssignee(user.id);
    const existingNext = await findDutyByWeekStart(nextPeriodStart);

    if (existingNext) {
      if (existingNext.status !== "scheduled") {
        throw conflict("Next duty already exists and is not scheduled");
      }

      await updateDutyPeriod(existingNext.id, {
        assignee_id: user.id,
        next_assignee_id: nextAssignee.id,
        status: "active",
      });
    } else {
      await insertDutyPeriod({
        assigneeId: user.id,
        nextAssigneeId: nextAssignee.id,
        weekStart: nextPeriodStart,
        weekEnd: nextPeriodEnd,
        status: "active",
        createdBy: user.id,
      });
    }

    await writeAuditLog({
      actorId: user.id,
      action: "handover_accepted",
      entityType: "duty_period",
      entityId: duty.id,
      payload: {
        nextPeriodStart,
        nextPeriodEnd,
        nextAssigneeId: nextAssignee.id,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
