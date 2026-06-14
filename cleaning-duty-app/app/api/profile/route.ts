import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import {
  updateProfile,
  updateProfilePassword,
  verifyProfilePassword,
  writeAuditLog,
} from "@/lib/data/store";
import { badRequest, handleRouteError } from "@/lib/http";

const UpdateOwnProfileSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2),
  currentPassword: z.string().trim().max(128).optional().default(""),
  password: z.string().trim().max(128).optional().default(""),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = UpdateOwnProfileSchema.parse(await request.json());
    const passwordTouched = body.currentPassword.length > 0 || body.password.length > 0;
    const passwordChanged = body.password.length > 0;

    if (passwordTouched && (!body.currentPassword || !body.password)) {
      throw badRequest("Щоб змінити пароль, введи поточний пароль і новий пароль");
    }

    if (passwordChanged && body.password.length < 8) {
      throw badRequest("Новий пароль має мати щонайменше 8 символів");
    }

    if (passwordChanged) {
      const currentPasswordMatches = await verifyProfilePassword({
        userId: user.id,
        email: user.email,
        password: body.currentPassword,
      });

      if (!currentPasswordMatches) {
        throw badRequest("Поточний пароль неправильний");
      }
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
