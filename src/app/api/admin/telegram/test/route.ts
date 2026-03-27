import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { decrypt } from '@/lib/crypto';
import { getTelegramBotInfo, sendTelegramMessage } from '@/lib/notifications/telegram';
import { auditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const settings = await prisma.settings.findFirst({
      select: {
        telegramBotToken: true,
        telegramChatId: true,
        telegramBotEnabled: true,
      },
    });

    if (!settings?.telegramBotToken) {
      return NextResponse.json(
        { message: 'Telegram bot token is not configured' },
        { status: 400 }
      );
    }

    const botToken = decrypt(settings.telegramBotToken);

    // Verify the token by calling getMe
    const botInfo = await getTelegramBotInfo(botToken);
    if (!botInfo.success) {
      return NextResponse.json(
        { message: `Bot token is invalid: ${botInfo.error}` },
        { status: 400 }
      );
    }

    // Optionally send a test message if chat ID is configured
    let messageSent = false;
    if (settings.telegramChatId) {
      messageSent = await sendTelegramMessage(
        botToken,
        settings.telegramChatId,
        '<b>Portalrr</b> — Test message. Telegram bot is connected and working!',
        'HTML'
      );
    }

    auditLog('telegram.test', { admin: auth.admin.username, botUsername: botInfo.botUsername });

    return NextResponse.json({
      success: true,
      botName: botInfo.botName,
      botUsername: botInfo.botUsername,
      messageSent,
    });
  } catch (error) {
    console.error('Error testing Telegram bot:', error);
    return NextResponse.json(
      { message: 'Failed to test Telegram bot connection' },
      { status: 500 }
    );
  }
}
