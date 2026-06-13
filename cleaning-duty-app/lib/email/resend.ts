import { Resend } from "resend";

import { requireEnv } from "@/lib/env";

export function createResendClient() {
  return new Resend(requireEnv("RESEND_API_KEY"));
}
