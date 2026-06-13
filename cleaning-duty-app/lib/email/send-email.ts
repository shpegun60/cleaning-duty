import { getEmailFrom } from "@/lib/env";
import { createResendClient } from "@/lib/email/resend";

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const resend = createResendClient();

  const { error } = await resend.emails.send({
    from: getEmailFrom(),
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    throw new Error(error.message);
  }
}
