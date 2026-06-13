import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { loadActiveRoom, upsertTask, writeAuditLog } from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const TaskSchema = z.object({
  id: z.string().uuid().optional(),
  roomId: z.string().uuid(),
  title: z.string().trim().min(2),
  description: z.string().trim().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = TaskSchema.parse(await request.json());

    if (body.isActive) {
      await loadActiveRoom(body.roomId);
    }

    const id = await upsertTask({
      id: body.id,
      roomId: body.roomId,
      title: body.title,
      description: body.description,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    });

    await writeAuditLog({
      actorId: admin.id,
      action: body.id ? "task_updated" : "task_created",
      entityType: "task",
      entityId: id,
      payload: body,
    });

    return Response.json({ ok: true, id });
  } catch (error) {
    return handleRouteError(error);
  }
}
