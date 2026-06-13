import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/domain/audit";
import { loadActiveRoom } from "@/lib/domain/loaders";
import { handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
    const supabase = createSupabaseAdminClient();

    if (body.isActive) {
      await loadActiveRoom(supabase, body.roomId);
    }

    const payload = {
      ...(body.id ? { id: body.id } : {}),
      room_id: body.roomId,
      title: body.title,
      description: body.description,
      sort_order: body.sortOrder,
      is_active: body.isActive,
    };

    const { data, error } = await supabase
      .from("tasks")
      .upsert(payload)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    await writeAuditLog(supabase, {
      actorId: admin.id,
      action: body.id ? "task_updated" : "task_created",
      entityType: "task",
      entityId: data.id,
      payload: body,
    });

    return Response.json({ ok: true, id: data.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
