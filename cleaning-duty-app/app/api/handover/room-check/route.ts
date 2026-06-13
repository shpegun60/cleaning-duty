import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import {
  loadActiveRoom,
  loadDutyPeriod,
  upsertRoomAcceptance,
  writeAuditLog,
} from "@/lib/data/store";
import { conflict, forbidden, handleRouteError } from "@/lib/http";

const RoomCheckSchema = z.object({
  dutyPeriodId: z.string().uuid(),
  roomId: z.string().uuid(),
  isAccepted: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = RoomCheckSchema.parse(await request.json());
    const duty = await loadDutyPeriod(body.dutyPeriodId);

    if (duty.next_assignee_id !== user.id) {
      throw forbidden("Only the next assignee can check rooms");
    }

    if (!["handover_pending", "ready_for_recheck"].includes(duty.status)) {
      throw conflict("Duty status does not allow handover checks");
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
