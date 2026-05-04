// Send a plain-text email via Gmail SMTP using `worker-mailer`, which uses
// Cloudflare Workers' TCP socket API to talk SMTP without Node/Nodemailer.
//
// Requires a Gmail App Password (https://myaccount.google.com/apppasswords) —
// 2FA must be enabled on the sending account. Stored as the `GMAIL_APP_PASSWORD`
// env secret in Cloudflare Pages.

import { WorkerMailer } from 'worker-mailer';

export interface SendEmailOptions {
  user: string;          // GMAIL_USER, e.g. info@ahdesign.website
  pass: string;          // GMAIL_APP_PASSWORD
  to: string;            // recipient
  from?: string;         // defaults to user
  fromName?: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const mailer = await WorkerMailer.connect({
    credentials: { username: opts.user, password: opts.pass },
    authType: 'plain',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
  });

  await mailer.send({
    from: opts.fromName ? { name: opts.fromName, email: opts.from ?? opts.user } : (opts.from ?? opts.user),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
  });
}
