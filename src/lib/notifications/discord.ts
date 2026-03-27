import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

const DISCORD_API = 'https://discord.com/api/v10';

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
}

async function discordFetch(
  botToken: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

/**
 * Send a DM to a user by Discord ID.
 */
export async function sendDiscordDM(
  botToken: string,
  userId: string,
  content: string
): Promise<boolean> {
  try {
    // Create a DM channel first
    const channelRes = await discordFetch(botToken, '/users/@me/channels', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: userId }),
    });
    if (!channelRes.ok) return false;

    const channel = await channelRes.json();

    // Send the message
    const msgRes = await discordFetch(botToken, `/channels/${channel.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    return msgRes.ok;
  } catch (err) {
    console.error('Failed to send Discord DM:', err);
    return false;
  }
}

/**
 * Assign a role to a guild member.
 */
export async function assignDiscordRole(
  botToken: string,
  guildId: string,
  userId: string,
  roleId: string
): Promise<boolean> {
  try {
    const res = await discordFetch(
      botToken,
      `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      { method: 'PUT' }
    );
    return res.ok;
  } catch (err) {
    console.error('Failed to assign Discord role:', err);
    return false;
  }
}

/**
 * Remove a role from a guild member.
 */
export async function removeDiscordRole(
  botToken: string,
  guildId: string,
  userId: string,
  roleId: string
): Promise<boolean> {
  try {
    const res = await discordFetch(
      botToken,
      `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch (err) {
    console.error('Failed to remove Discord role:', err);
    return false;
  }
}

/**
 * Send a message to a channel.
 */
export async function sendDiscordChannelMessage(
  botToken: string,
  channelId: string,
  content: string,
  embed?: DiscordEmbed
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { content };
    if (embed) {
      body.embeds = [embed];
    }
    const res = await discordFetch(botToken, `/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to send Discord channel message:', err);
    return false;
  }
}

/**
 * Get guild roles (for the settings dropdown).
 */
export async function getDiscordGuildRoles(
  botToken: string,
  guildId: string
): Promise<{ id: string; name: string; color: number }[]> {
  try {
    const res = await discordFetch(botToken, `/guilds/${guildId}/roles`);
    if (!res.ok) return [];
    const roles = await res.json();
    return roles
      .filter((r: { managed: boolean; name: string }) => !r.managed && r.name !== '@everyone')
      .map((r: { id: string; name: string; color: number }) => ({
        id: r.id,
        name: r.name,
        color: r.color,
      }));
  } catch (err) {
    console.error('Failed to fetch Discord guild roles:', err);
    return [];
  }
}

/**
 * Get guild channels (for the settings dropdown).
 */
export async function getDiscordGuildChannels(
  botToken: string,
  guildId: string
): Promise<{ id: string; name: string; type: number }[]> {
  try {
    const res = await discordFetch(botToken, `/guilds/${guildId}/channels`);
    if (!res.ok) return [];
    const channels = await res.json();
    // Only return text channels (type 0) and announcement channels (type 5)
    return channels
      .filter((c: { type: number }) => c.type === 0 || c.type === 5)
      .map((c: { id: string; name: string; type: number }) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }));
  } catch (err) {
    console.error('Failed to fetch Discord guild channels:', err);
    return [];
  }
}

/**
 * Test bot connection (verify token + guild access).
 */
export async function testDiscordBot(
  botToken: string,
  guildId: string
): Promise<{ success: boolean; botName?: string; error?: string }> {
  try {
    // Verify token by getting bot user
    const userRes = await discordFetch(botToken, '/users/@me');
    if (!userRes.ok) {
      return { success: false, error: 'Invalid bot token' };
    }
    const user = await userRes.json();

    // Verify guild access
    const guildRes = await discordFetch(botToken, `/guilds/${guildId}`);
    if (!guildRes.ok) {
      return { success: false, error: 'Bot does not have access to the specified guild' };
    }

    return { success: true, botName: `${user.username}#${user.discriminator || '0'}` };
  } catch (err) {
    console.error('Discord bot test failed:', err);
    return { success: false, error: 'Failed to connect to Discord API' };
  }
}

/**
 * Dispatch a notification based on event type.
 * Reads settings from DB, checks if bot is enabled, and sends appropriate messages.
 */
export async function dispatchDiscordNotification(
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const settings = await prisma.settings.findFirst({
      select: {
        discordBotEnabled: true,
        discordBotToken: true,
        discordGuildId: true,
        discordNotifyChannelId: true,
        discordRoleId: true,
      },
    });

    if (!settings?.discordBotEnabled || !settings.discordBotToken) return;

    const botToken = decrypt(settings.discordBotToken);
    if (!botToken) return;

    const channelId = settings.discordNotifyChannelId;
    const guildId = settings.discordGuildId;
    const roleId = settings.discordRoleId;

    // Send channel notification
    if (channelId) {
      let message = '';
      let embed: DiscordEmbed | undefined;

      switch (event) {
        case 'user.registered':
          message = `New user registered: **${data.username}**`;
          embed = {
            title: 'New Registration',
            description: `User **${data.username}** has registered.`,
            color: 0x22c55e,
            fields: [
              ...(data.email ? [{ name: 'Email', value: String(data.email), inline: true }] : []),
              ...(data.server ? [{ name: 'Server', value: String(data.server), inline: true }] : []),
            ],
            timestamp: new Date().toISOString(),
          };
          break;
        case 'user.disabled':
          message = `User disabled: **${data.username}**`;
          embed = {
            title: 'User Disabled',
            description: `User **${data.username}** has been disabled.`,
            color: 0xf59e0b,
            fields: data.reason ? [{ name: 'Reason', value: String(data.reason) }] : [],
            timestamp: new Date().toISOString(),
          };
          break;
        case 'user.deleted':
          message = `User deleted: **${data.username}**`;
          embed = {
            title: 'User Deleted',
            description: `User **${data.username}** has been deleted.`,
            color: 0xef4444,
            timestamp: new Date().toISOString(),
          };
          break;
        case 'user.enabled':
          message = `User re-enabled: **${data.username}**`;
          embed = {
            title: 'User Re-enabled',
            description: `User **${data.username}** has been re-enabled.`,
            color: 0x22c55e,
            timestamp: new Date().toISOString(),
          };
          break;
        case 'announcement.sent':
          message = `Announcement: **${data.title}**`;
          embed = {
            title: String(data.title),
            description: String(data.body || ''),
            color: 0x3b82f6,
            fields: data.recipientCount
              ? [{ name: 'Recipients', value: String(data.recipientCount), inline: true }]
              : [],
            timestamp: new Date().toISOString(),
          };
          break;
        default:
          return;
      }

      await sendDiscordChannelMessage(botToken, channelId, message, embed);
    }

    // Handle role assignment/removal
    const discordId = data.discordId as string | undefined;
    if (discordId && guildId && roleId) {
      if (event === 'user.registered' || event === 'user.enabled') {
        await assignDiscordRole(botToken, guildId, discordId, roleId);
      } else if (event === 'user.disabled' || event === 'user.deleted') {
        await removeDiscordRole(botToken, guildId, discordId, roleId);
      }
    }
  } catch (err) {
    console.error('Failed to dispatch Discord notification:', err);
  }
}
