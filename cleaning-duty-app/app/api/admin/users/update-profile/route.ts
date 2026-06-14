import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import {
  assertScheduleIsEmptyForRosterConfig,
  loadProfile,
  updateProfile,
  updateProfilePassword,
  writeAuditLog,
} from "@/lib/data/store";
import { badRequest, handleRouteError } from "@/lib/http";

const UpdateProfileSchema = z.object({
  userId: z.string().min(1),
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2),
  role: z.enum(["admin", "worker"]),
  rotationOrder: z.number().int().min(1).nullable(),
  isActive: z.boolean(),
  password: z.string().trim().max(128).optional().default(""),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = UpdateProfileSchema.parse(await request.json());
    const existing = await loadProfile(body.userId);
    const nextRotationOrder = body.role === "worker" ? body.rotationOrder : null;
    const passwordChanged = body.password.length > 0;
    const rosterChanged =
      existing.role !== body.role ||
      existing.is_active !== body.isActive ||
      (existing.rotation_order ?? null) !== nextRotationOrder;

    if (passwordChanged && body.password.length < 8) {
      throw badRequest("Password must be at least 8 characters");
    }

    if (rosterChanged) {
      await assertScheduleIsEmptyForRosterConfig();
    }

    await updateProfile({
      userId: body.userId,
      email: body.email,
      fullName: body.fullName,
      role: body.role,
      rotationOrder: body.rotationOrder,
      isActive: body.isActive,
    });

    if (passwordChanged) {
      await updateProfilePassword(body.userId, body.password);
    }

    await writeAuditLog({
      actorId: admin.id,
      action: "profile_updated",
      entityType: "profile",
      entityId: body.userId,
      payload: {
        userId: body.userId,
        email: body.email,
        fullName: body.fullName,
        role: body.role,
        rotationOrder: body.rotationOrder,
        isActive: body.isActive,
        passwordChanged,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
