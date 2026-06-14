import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { generateTemporaryPassword } from "@/lib/auth/passwords";
import { readRuntimeConfig } from "@/lib/config/runtime";
import {
  assertScheduleIsEmptyForRosterConfig,
  createNotificationIfMissing,
  createProfile,
  markNotificationFailed,
  markNotificationSent,
  writeAuditLog,
} from "@/lib/data/store";
import { userInvitedTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import { handleRouteError } from "@/lib/http";

const InviteUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(2),
  role: z.enum(["admin", "worker"]),
  rotationOrder: z.number().int().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = InviteUserSchema.parse(await request.json());
    await assertScheduleIsEmptyForRosterConfig();
    const password = generateTemporaryPassword();
    const userId = await createProfile({
      email: body.email,
      fullName: body.fullName,
      role: body.role,
      rotationOrder: body.rotationOrder ?? null,
      initialPassword: password,
    });
    const notification = await createNotificationIfMissing({
      dutyPeriodId: null,
      recipientId: userId,
      type: "user_invited",
      scheduledFor: new Date(),
    });

    if (notification.created && notification.id) {
      try {
        const template = userInvitedTemplate({
          name: body.fullName,
          loginUrl: `${readRuntimeConfig().appUrl}/login`,
          email: body.email,
          password,
        });
        await sendEmail({ to: body.email, ...template });
        await markNotificationSent(notification.id);
      } catch (errorCause) {
        await markNotificationFailed(notification.id, errorCause);
      }
    }

    await writeAuditLog({
      actorId: admin.id,
      action: "user_invited",
      entityType: "profile",
      entityId: userId,
      payload: {
        ...body,
        notificationId: notification.id,
      },
    });

    return Response.json({ ok: true, userId });
  } catch (error) {
    return handleRouteError(error);
  }
}
