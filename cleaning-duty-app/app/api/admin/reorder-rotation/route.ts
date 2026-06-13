import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/domain/audit";
import { badRequest, handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ReorderRotationSchema = z.object({
  items: z.array(
    z.object({
      userId: z.string().uuid(),
      rotationOrder: z.number().int().nullable(),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = ReorderRotationSchema.parse(await request.json());
    const nonNullOrders = body.items
      .map((item) => item.rotationOrder)
      .filter((value): value is number => value !== null);
    const uniqueOrders = new Set(nonNullOrders);

    if (uniqueOrders.size !== nonNullOrders.length) {
      throw badRequest("Rotation order values must be unique");
    }

    const supabase = createSupabaseAdminClient();

    for (const item of body.items) {
      const { error } = await supabase
        .from("profiles")
        .update({ rotation_order: item.rotationOrder })
        .eq("id", item.userId);

      if (error) {
        throw error;
      }
    }

    await writeAuditLog(supabase, {
      actorId: admin.id,
      action: "rotation_reordered",
      entityType: "profile",
      payload: body,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
