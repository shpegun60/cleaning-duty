import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { updateProfile, loadProfile, writeAuditLog } from "@/lib/data/store";
import { badRequest, handleRouteError } from "@/lib/http";

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

    for (const item of body.items) {
      const profile = await loadProfile(item.userId);
      await updateProfile({
        userId: profile.id,
        fullName: profile.full_name,
        role: profile.role,
        rotationOrder: item.rotationOrder,
        isActive: profile.is_active,
      });
    }

    await writeAuditLog({
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
