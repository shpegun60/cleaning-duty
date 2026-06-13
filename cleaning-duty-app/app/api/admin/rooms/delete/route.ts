import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { removeRoom, writeAuditLog } from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const DeleteRoomSchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = DeleteRoomSchema.parse(await request.json());
    const result = await removeRoom(body.id);

    await writeAuditLog({
      actorId: admin.id,
      action: "room_removed",
      entityType: "room",
      entityId: body.id,
      payload: { result },
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    return handleRouteError(error);
  }
}
