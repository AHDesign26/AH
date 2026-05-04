// Cloudflare Pages Function — POST /api/order. Same logic as /api/contact
// but tagged differently in the Telegram/email subject line.

import { handle } from './contact';

interface Env {
  TURNSTILE_SECRET_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  GMAIL_USER: string;
  GMAIL_APP_PASSWORD: string;
  CONTACT_TO_EMAIL?: string;
  ORIGIN?: string;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  return handle(ctx as never, 'Order');
};
