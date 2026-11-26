import { db } from '../db/index.ts';
import { emailLogs } from '../db/schema.ts';

export interface TransactionalEmailInput {
  to: string;
  subject: string;
  template: string;
  html: string;
}

export interface EmailDispatchResult {
  sent: boolean;
  status: 'sent' | 'not_configured' | 'failed';
  provider: string;
  message: string;
}

/**
 * Dispatches transactional emails when RESEND_API_KEY is configured in server environment.
 * Never claims an email was sent unless the external email provider confirms acceptance.
 */
export async function sendTransactionalEmail(
  input: TransactionalEmailInput
): Promise<EmailDispatchResult> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress = process.env.EMAIL_FROM?.trim() || 'SHAIKCART <onboarding@resend.dev>';

  if (!resendApiKey) {
    try {
      await db.insert(emailLogs).values({
        recipient: input.to,
        subject: input.subject,
        template: input.template,
        provider: 'unconfigured',
        status: 'not_configured',
        errorMessage: 'RESEND_API_KEY is not configured in environment variables.',
      });
    } catch (err) {
      console.error('Failed to log unconfigured email attempt:', err);
    }
    return {
      sent: false,
      status: 'not_configured',
      provider: 'unconfigured',
      message: 'Email provider is not configured. Configure RESEND_API_KEY to enable live email delivery.',
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Provider rejected email');
      await db.insert(emailLogs).values({
        recipient: input.to,
        subject: input.subject,
        template: input.template,
        provider: 'resend',
        status: 'failed',
        errorMessage: errorText.slice(0, 500),
      });
      return {
        sent: false,
        status: 'failed',
        provider: 'resend',
        message: 'Email provider rejected the delivery request.',
      };
    }

    await db.insert(emailLogs).values({
      recipient: input.to,
      subject: input.subject,
      template: input.template,
      provider: 'resend',
      status: 'sent',
      errorMessage: '',
    });

    return {
      sent: true,
      status: 'sent',
      provider: 'resend',
      message: 'Transactional email accepted by provider.',
    };
  } catch (error: any) {
    const errMsg = error?.message || 'Network error while sending email';
    try {
      await db.insert(emailLogs).values({
        recipient: input.to,
        subject: input.subject,
        template: input.template,
        provider: 'resend',
        status: 'failed',
        errorMessage: errMsg.slice(0, 500),
      });
    } catch (logErr) {
      console.error('Failed to record email error log:', logErr);
    }
    return {
      sent: false,
      status: 'failed',
      provider: 'resend',
      message: 'Unable to reach email service provider.',
    };
  }
}
