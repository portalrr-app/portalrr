import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { decrypt } from '@/lib/crypto';
import { getDiscordGuildChannels } from '@/lib/notifications/discord';

export async function GET(request: NextRequest) {
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

    const channels = await getDiscordGuildChannels(botToken, settings.discordGuildId);
    return NextResponse.json(channels);
  } catch (error) {
    console.error('Error fetching Discord channels:', error);
    return NextResponse.json(
      { message: 'Failed to fetch Discord channels' },
      { status: 500 }
    );
  }
}
