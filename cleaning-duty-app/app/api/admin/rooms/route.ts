import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { upsertRoom, writeAuditLog } from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const RoomSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2),
  description: z.string().trim().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = RoomSchema.parse(await request.json());
    const id = await upsertRoom({
      id: body.id,
      name: body.name,
      description: body.description,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    });

    await writeAuditLog({
      actorId: admin.id,
      action: body.id ? "room_updated" : "room_created",
      entityType: "room",
      entityId: id,
      payload: body,
    });

    return Response.json({ ok: true, id });
  } catch (error) {
    return handleRouteError(error);
  }
}
