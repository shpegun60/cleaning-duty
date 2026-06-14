import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { conflict, handleRouteError } from "@/lib/http";

const ReadyForRecheckSchema = z.object({
  dutyPeriodId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    await requireUser();
    ReadyForRecheckSchema.parse(await request.json());
    throw conflict(
      "Recheck flow is disabled. Rejected handovers automatically repeat the assignee in the next duty.",
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
