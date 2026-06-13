import { readRuntimeConfig } from "@/lib/config/runtime";
import { createResendClient } from "@/lib/email/resend";

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const resend = createResendClient();
  const config = readRuntimeConfig();

  const { error } = await resend.emails.send({
    from: config.emailFrom,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    throw new Error(error.message);
  }
}
