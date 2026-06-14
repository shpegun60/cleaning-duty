import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import {
  loadActiveRoom,
  loadDutyPeriod,
  updateDutyPeriod,
  upsertRoomAcceptance,
  writeAuditLog,
} from "@/lib/data/store";
import { conflict, forbidden, handleRouteError } from "@/lib/http";

const RoomCheckSchema = z.object({
  dutyPeriodId: z.string().uuid(),
  roomId: z.string().trim().min(1),
  isAccepted: z.boolean(),
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
    const body = RoomCheckSchema.parse(await request.json());
    const duty = await loadDutyPeriod(body.dutyPeriodId);
    const isAdmin = user.role === "admin";

    if (duty.next_assignee_id !== user.id && !isAdmin) {
      throw forbidden("Only the next assignee can check rooms");
    }

    if (
      (!isAdmin && !WORKER_HANDOVER_STATUSES.includes(duty.status)) ||
      (isAdmin && !ADMIN_HANDOVER_STATUSES.includes(duty.status))
    ) {
      throw conflict("Duty status does not allow handover checks");
    }

    if (duty.status === "cleaning_done") {
      await updateDutyPeriod(duty.id, {
        status: "handover_pending",
        handover_started_at: new Date().toISOString(),
      });
    }

    await loadActiveRoom(body.roomId);
    await upsertRoomAcceptance({
      dutyPeriodId: body.dutyPeriodId,
      roomId: body.roomId,
      acceptedBy: user.id,
      status: body.isAccepted ? "accepted" : "pending",
      comment: null,
    });

    await writeAuditLog({
      actorId: user.id,
      action: "room_acceptance_updated",
      entityType: "room_acceptance",
      payload: body,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
