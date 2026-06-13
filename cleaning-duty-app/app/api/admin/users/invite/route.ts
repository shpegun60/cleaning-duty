import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { createProfile, writeAuditLog } from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const InviteUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(2),
  role: z.enum(["admin", "worker"]),
  rotationOrder: z.number().int().min(1).nullable(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = InviteUserSchema.parse(await request.json());
    const userId = await createProfile({
      email: body.email,
      fullName: body.fullName,
      role: body.role,
      rotationOrder: body.rotationOrder,
    });

    await writeAuditLog({
      actorId: admin.id,
      action: "user_invited",
      entityType: "profile",
      entityId: userId,
      payload: body,
    });

    return Response.json({ ok: true, userId });
  } catch (error) {
    return handleRouteError(error);
  }
}
