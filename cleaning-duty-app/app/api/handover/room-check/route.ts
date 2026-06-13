import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/domain/audit";
import { loadActiveRoom, loadDutyPeriod } from "@/lib/domain/loaders";
import { conflict, forbidden, handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const RoomCheckSchema = z.object({
  dutyPeriodId: z.string().uuid(),
  roomId: z.string().uuid(),
  isAccepted: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = RoomCheckSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const duty = await loadDutyPeriod(supabase, body.dutyPeriodId);

    if (duty.next_assignee_id !== user.id) {
      throw forbidden("Only the next assignee can check rooms");
    }

    if (!["handover_pending", "ready_for_recheck"].includes(duty.status)) {
      throw conflict("Duty status does not allow handover checks");
    }

    await loadActiveRoom(supabase, body.roomId);

    const { error } = await supabase.from("room_acceptances").upsert(
      {
        duty_period_id: body.dutyPeriodId,
        room_id: body.roomId,
        accepted_by: user.id,
        status: body.isAccepted ? "accepted" : "pending",
        checked_at: body.isAccepted ? new Date().toISOString() : null,
        comment: null,
      },
      { onConflict: "duty_period_id,room_id" },
    );

    if (error) {
      throw error;
    }

    await writeAuditLog(supabase, {
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
