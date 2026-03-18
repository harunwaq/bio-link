// Email sending stub - replace with actual email service (Resend, Mailgun, etc.)
export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  // In production, integrate with an email service like Resend or Mailgun
  console.log(`[EMAIL STUB] Sending verification code ${code} to ${email}`);
  console.log(`[EMAIL STUB] In production, replace this with actual email sending.`);
}

export async function sendSubscriberEmail(
  to: string[],
  subject: string,
  body: string
): Promise<void> {
  console.log(`[EMAIL STUB] Sending email to ${to.length} subscribers`);
  console.log(`[EMAIL STUB] Subject: ${subject}`);
  console.log(`[EMAIL STUB] Body: ${body}`);
}
