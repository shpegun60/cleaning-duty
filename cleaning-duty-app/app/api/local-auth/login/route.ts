import { z } from "zod";

import { readRuntimeConfig } from "@/lib/config/runtime";
import { handleRouteError, unauthorized } from "@/lib/http";
import { setLocalSession } from "@/lib/local/auth";

const LocalLoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = LocalLoginSchema.parse(await request.json());
    const config = readRuntimeConfig();

    if (body.username !== config.setupUsername || body.password !== config.setupPassword) {
      throw unauthorized("Invalid local admin credentials");
    }

    await setLocalSession();
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
