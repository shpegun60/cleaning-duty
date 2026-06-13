import { NextRequest } from "next/server";

import { readRuntimeConfig } from "@/lib/config/runtime";
import { handleRouteError } from "@/lib/http";
import { runScheduler } from "@/lib/scheduler/scheduler";

export async function GET(request: NextRequest) {
  try {
    const cronSecret = readRuntimeConfig().cronSecret;

    if (!cronSecret) {
      return Response.json({ error: "Missing CRON_SECRET" }, { status: 500 });
    }

    if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return Response.json(await runScheduler());
  } catch (error) {
    return handleRouteError(error);
  }
}
