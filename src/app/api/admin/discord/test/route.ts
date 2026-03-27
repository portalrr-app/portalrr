import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { decrypt } from '@/lib/crypto';
import { testDiscordBot } from '@/lib/notifications/discord';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const settings = await prisma.settings.findFirst({
      select: {
        discordBotToken: true,
        discordGuildId: true,
      },
    });

    if (!settings?.discordBotToken || !settings?.discordGuildId) {
      return NextResponse.json(
        { message: 'Discord bot token and guild ID are required' },
        { status: 400 }
      );
    }

    const botToken = decrypt(settings.discordBotToken);
    if (!botToken) {
      return NextResponse.json(
        { message: 'Failed to decrypt bot token' },
        { status: 500 }
      );
    }

    const result = await testDiscordBot(botToken, settings.discordGuildId);

    if (result.success) {
      return NextResponse.json({ success: true, botName: result.botName });
    }

    return NextResponse.json(
      { message: result.error || 'Connection failed' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error testing Discord bot:', error);
    return NextResponse.json(
      { message: 'Failed to test Discord bot connection' },
      { status: 500 }
    );
  }
}
