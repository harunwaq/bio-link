// Resend email integration
const RESEND_API = 'https://api.resend.com/emails';

async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Bio Link <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('Resend error:', error);
    throw new Error('Failed to send email');
  }

  return res.json();
}

export async function sendVerificationEmail(email: string, code: string, apiKey: string): Promise<void> {
  await sendEmail(
    apiKey,
    email,
    'Your Bio Link verification code',
    `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border: 2px solid #1a1a1a; font-size: 8px; font-weight: 800; line-height: 1; text-align: center;">
          BIO.<br/>LINK
        </div>
      </div>
      <h1 style="font-size: 24px; font-weight: 700; text-align: center; margin-bottom: 8px;">Verify your email</h1>
      <p style="color: #6b7280; text-align: center; margin-bottom: 32px;">Enter this code to complete your signup:</p>
      <div style="background: linear-gradient(135deg, #f9357b, #f97316); color: white; font-size: 36px; font-weight: 800; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 12px; margin-bottom: 32px;">
        ${code}
      </div>
      <p style="color: #9ca3af; font-size: 13px; text-align: center;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
    `
  );
}

export async function sendSubscriberEmail(
  to: string[],
  subject: string,
  body: string,
  apiKey: string
): Promise<void> {
  // Send to each subscriber individually
  for (const email of to) {
    await sendEmail(apiKey, email, subject, `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        ${body}
      </div>
    `);
  }
}
