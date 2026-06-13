import { NextRequest } from "next/server";

import { handleRouteError } from "@/lib/http";
import { runScheduler } from "@/lib/scheduler/scheduler";

export async function GET(request: NextRequest) {
  try {
    if (!process.env.CRON_SECRET) {
      return Response.json({ error: "Missing CRON_SECRET" }, { status: 500 });
    }

    if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return Response.json(await runScheduler());
  } catch (error) {
    return handleRouteError(error);
  }
}
