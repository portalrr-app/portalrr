import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

const TELEGRAM_API = 'https://api.telegram.org/bot';

/**
 * Send a message to a Telegram chat/user.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode?: 'HTML' | 'Markdown'
): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode || 'HTML',
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`Telegram sendMessage failed: ${res.status} ${err}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Telegram sendMessage error:', error);
    return false;
  }
}

/**
 * Get bot info to verify the token is valid.
 */
export async function getTelegramBotInfo(
  botToken: string
): Promise<{ success: boolean; botName?: string; botUsername?: string; error?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API}${botToken}/getMe`);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `API error ${res.status}: ${errText}` };
    }
    const data = await res.json();
    if (!data.ok) {
      return { success: false, error: data.description || 'Unknown error' };
    }
    return {
      success: true,
      botName: data.result.first_name,
      botUsername: data.result.username,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Send a message with inline keyboard buttons.
 */
export async function sendTelegramMessageWithButtons(
  botToken: string,
  chatId: string,
  text: string,
  buttons: { text: string; url: string }[][]
): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: buttons.map((row) =>
            row.map((btn) => ({ text: btn.text, url: btn.url }))
          ),
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`Telegram sendMessageWithButtons failed: ${res.status} ${err}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Telegram sendMessageWithButtons error:', error);
    return false;
  }
}

/**
 * Dispatch a notification based on event type.
 * Reads settings from DB, checks if bot is enabled, formats message, sends to configured chat.
 * Fire-and-forget — errors are logged but not thrown.
 */
export async function dispatchTelegramNotification(
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const settings = await prisma.settings.findFirst({
      select: {
        telegramBotEnabled: true,
        telegramBotToken: true,
        telegramChatId: true,
        appName: true,
      },
    });

    if (!settings?.telegramBotEnabled || !settings.telegramBotToken || !settings.telegramChatId) {
      return;
    }

    const botToken = decrypt(settings.telegramBotToken);
    const chatId = settings.telegramChatId;
    const appName = settings.appName || 'Portalrr';

    const message = formatNotification(event, data, appName);
    if (!message) return;

    await sendTelegramMessage(botToken, chatId, message, 'HTML');
  } catch (error) {
    console.error('dispatchTelegramNotification error:', error);
  }
}

function formatNotification(
  event: string,
  data: Record<string, unknown>,
  appName: string
): string | null {
  switch (event) {
    case 'user.registered':
      return (
        `<b>${appName} — New Registration</b>\n\n` +
        `User <b>${escapeHtml(String(data.username || ''))}</b> has registered.\n` +
        (data.email ? `Email: ${escapeHtml(String(data.email))}\n` : '') +
        (data.server ? `Server: ${escapeHtml(String(data.server))}` : '')
      );

    case 'user.disabled':
      return (
        `<b>${appName} — User Disabled</b>\n\n` +
        `User <b>${escapeHtml(String(data.username || ''))}</b> has been disabled.\n` +
        (data.reason ? `Reason: ${escapeHtml(String(data.reason))}` : '')
      );

    case 'user.enabled':
      return (
        `<b>${appName} — User Enabled</b>\n\n` +
        `User <b>${escapeHtml(String(data.username || ''))}</b> has been re-enabled.`
      );

    case 'user.deleted':
      return (
        `<b>${appName} — User Deleted</b>\n\n` +
        `User <b>${escapeHtml(String(data.username || ''))}</b> has been deleted.`
      );

    case 'announcement.sent':
      return (
        `<b>${appName} — Announcement</b>\n\n` +
        `<b>${escapeHtml(String(data.title || ''))}</b>\n\n` +
        escapeHtml(String(data.body || ''))
      );

    default:
      return null;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
