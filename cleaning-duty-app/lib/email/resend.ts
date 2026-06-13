import { Resend } from "resend";

import { readRuntimeConfig } from "@/lib/config/runtime";

export function createResendClient() {
  const apiKey = readRuntimeConfig().resendApiKey;

  if (!apiKey) {
    throw new Error("Missing Resend API key");
  }

  return new Resend(apiKey);
}
