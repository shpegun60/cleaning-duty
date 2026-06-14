import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import {
  assertScheduleIsEmptyForRosterConfig,
  loadProfile,
  updateProfile,
  writeAuditLog,
} from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const UpdateProfileSchema = z.object({
  userId: z.string().min(1),
  fullName: z.string().trim().min(2),
  role: z.enum(["admin", "worker"]),
  rotationOrder: z.number().int().min(1).nullable(),
  isActive: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = UpdateProfileSchema.parse(await request.json());
    const existing = await loadProfile(body.userId);
    const nextRotationOrder = body.role === "worker" ? body.rotationOrder : null;
    const rosterChanged =
      existing.role !== body.role ||
      existing.is_active !== body.isActive ||
      (existing.rotation_order ?? null) !== nextRotationOrder;

    if (rosterChanged) {
      await assertScheduleIsEmptyForRosterConfig();
    }

    await updateProfile(body);

    await writeAuditLog({
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
