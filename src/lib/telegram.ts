// Send a message to a Telegram chat via the Bot API. Replaces the
// `bot.send_message(CHAT_ID, telegram_msg)` call in app.py:308.

export interface TelegramSendOptions {
  botToken: string;
  chatId: string | number;
  text: string;
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
}

export async function sendTelegram(opts: TelegramSendOptions): Promise<{
  ok: boolean;
  status: number;
  body?: unknown;
}> {
  const url = `https://api.telegram.org/bot${opts.botToken}/sendMessage`;
  const payload: Record<string, unknown> = {
    chat_id: opts.chatId,
    text: opts.text,
  };
  if (opts.parseMode) payload.parse_mode = opts.parseMode;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { ok: false, status: 0, body: { error: String(e) } };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  return { ok: res.ok, status: res.status, body };
}
