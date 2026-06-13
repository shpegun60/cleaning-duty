import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { reorderActiveWorkerRotation, writeAuditLog } from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const ReorderRotationSchema = z.object({
  items: z.array(
    z.object({
      userId: z.string().min(1),
      rotationOrder: z.number().int().min(1),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = ReorderRotationSchema.parse(await request.json());
    const items = await reorderActiveWorkerRotation(body.items);

    await writeAuditLog({
      actorId: admin.id,
      action: "rotation_reordered",
      entityType: "profile",
      payload: { items },
    });

    return Response.json({ ok: true, items });
  } catch (error) {
    return handleRouteError(error);
  }
}
