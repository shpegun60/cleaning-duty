import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import {
  updateProfile,
  updateProfilePassword,
  writeAuditLog,
} from "@/lib/data/store";
import { badRequest, handleRouteError } from "@/lib/http";

const UpdateOwnProfileSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2),
  password: z.string().trim().max(128).optional().default(""),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = UpdateOwnProfileSchema.parse(await request.json());
    const passwordChanged = body.password.length > 0;

    if (passwordChanged && body.password.length < 8) {
      throw badRequest("Password must be at least 8 characters");
    }

    await updateProfile({
      userId: user.id,
      email: body.email,
      fullName: body.fullName,
      role: user.role,
      rotationOrder: user.rotation_order,
      isActive: user.is_active,
    });

    if (passwordChanged) {
      await updateProfilePassword(user.id, body.password);
    }

    await writeAuditLog({
      actorId: user.id,
      action: "own_profile_updated",
      entityType: "profile",
      entityId: user.id,
      payload: {
        emailChanged: body.email !== user.email,
        fullNameChanged: body.fullName !== user.full_name,
        passwordChanged,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
