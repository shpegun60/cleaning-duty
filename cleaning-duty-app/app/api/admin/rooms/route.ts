import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/domain/audit";
import { handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
    const supabase = createSupabaseAdminClient();

    const payload = {
      ...(body.id ? { id: body.id } : {}),
      name: body.name,
      description: body.description,
      sort_order: body.sortOrder,
      is_active: body.isActive,
    };

    const { data, error } = await supabase
      .from("rooms")
      .upsert(payload)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    await writeAuditLog(supabase, {
      actorId: admin.id,
      action: body.id ? "room_updated" : "room_created",
      entityType: "room",
      entityId: data.id,
      payload: body,
    });

    return Response.json({ ok: true, id: data.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
