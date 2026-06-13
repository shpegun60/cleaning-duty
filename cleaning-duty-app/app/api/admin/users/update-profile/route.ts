import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/domain/audit";
import { handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UpdateProfileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2),
  role: z.enum(["admin", "worker"]),
  rotationOrder: z.number().int().nullable(),
  isActive: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = UpdateProfileSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: body.fullName,
        role: body.role,
        rotation_order: body.rotationOrder,
        is_active: body.isActive,
      })
      .eq("id", body.userId);

    if (error) {
      throw error;
    }

    await writeAuditLog(supabase, {
      actorId: admin.id,
      action: "profile_updated",
      entityType: "profile",
      entityId: body.userId,
      payload: body,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
