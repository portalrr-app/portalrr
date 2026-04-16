import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { runAutoRemoveIfDue } from '@/lib/auto-remove';
import { decryptServerSecrets } from '@/lib/crypto';
import { jellyfinUserUrl } from '@/lib/servers/jellyfin';
import { logOnError } from '@/lib/logger';

interface ViewingActivity {
  id: string;
  userId: string;
  userName: string;
  itemId: string;
  itemName: string;
  itemType: string;
  playedAt: string;
  duration: number;
  deviceName: string;
  clientName: string;
}

interface UserStats {
  userId: string;
  userName: string;
  totalWatchTime: number;
  itemsWatched: number;
  lastActivity: string;
}

// Fetch stats using the Playback Reporting plugin (accurate real watch times)
async function getJellyfinStatsFromPlugin(serverUrl: string, apiKey: string): Promise<{
  recentActivity: ViewingActivity[];
  userStats: UserStats[];
} | null> {
  const headers = { 'X-MediaBrowser-Token': apiKey, 'Accept': 'application/json' };

  // Fetch all Jellyfin users first so everyone shows up
  const usersRes = await fetch(`${serverUrl}/Users`, { headers });
  if (!usersRes.ok) return null;
  const rawUsers = await usersRes.json();
  if (!Array.isArray(rawUsers)) return null;

  // Filter out hidden, disabled, and unnamed/internal accounts
  const filteredUsers = rawUsers.filter((user: Record<string, unknown>) => {
    if (!user.Name) return false;
    const policy = user.Policy as Record<string, unknown> | undefined;
    if (!policy) return true; // keep user if no policy data available
    if (policy.IsHidden) return false;
    if (policy.IsDisabled) return false;
    return true;
  });
  // If filter removed everyone, fall back to the full list
  const allUsers = filteredUsers.length > 0 ? filteredUsers : rawUsers;

  // Get plugin activity data (all-time)
  const timezoneOffset = new Date().getTimezoneOffset() / -60;
  const userActivityRes = await fetch(
    `${serverUrl}/user_usage_stats/user_activity?` + new URLSearchParams({
      days: '36500',
      timezoneOffset: timezoneOffset.toString(),
    }).toString(),
    { headers }
  );

  if (!userActivityRes.ok) return null;

  const userActivity = await userActivityRes.json();
  if (!Array.isArray(userActivity)) return null;

  // Build a map of plugin data keyed by user_id
  const pluginDataMap = new Map<string, Record<string, unknown>>();
  for (const u of userActivity) {
    pluginDataMap.set(u.user_id as string, u);
  }

  // Merge: all Jellyfin users + plugin data where available
  const userStats: UserStats[] = allUsers.slice(0, 20).map((user: Record<string, unknown>) => {
    const userId = user.Id as string;
    const pluginData = pluginDataMap.get(userId);

    let watchTime = 0;
    let playCount = 0;
    let lastActivity = '';

    if (pluginData) {
      if (typeof pluginData.total_time === 'number') {
        watchTime = Math.max(0, pluginData.total_time);
      } else if (typeof pluginData.total_time === 'string') {
        watchTime = Math.max(0, parseInt(pluginData.total_time) || 0);
      }

      if (typeof pluginData.total_count === 'number') {
        playCount = pluginData.total_count;
      } else if (typeof pluginData.total_count === 'string') {
        playCount = parseInt(pluginData.total_count) || 0;
      }

      lastActivity = (pluginData.latest_date as string) || '';
    }

    return {
      userId,
      userName: user.Name as string,
      totalWatchTime: watchTime,
      itemsWatched: playCount,
      lastActivity,
    };
  });

  // Get recent activity in a single query via the plugin's custom SQL endpoint
  // Column order: 0=DateCreated, 1=UserId, 2=ItemId, 3=ItemType, 4=ItemName, 5=PlaybackMethod, 6=ClientName, 7=DeviceName, 8=PlayDuration
  const recentActivity: ViewingActivity[] = [];

  const queryRes = await fetch(`${serverUrl}/user_usage_stats/submit_custom_query`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      CustomQueryString: "SELECT DateCreated, UserId, ItemId, ItemType, ItemName, PlaybackMethod, ClientName, DeviceName, PlayDuration FROM PlaybackActivity ORDER BY DateCreated DESC LIMIT 50",
      ReplaceUserId: true,
    }),
  });

  if (queryRes.ok) {
    const queryData = await queryRes.json();
    const rows: string[][] = queryData.results || [];

    for (const row of rows) {
      const duration = parseInt(row[8]) || 0;

      recentActivity.push({
        id: `${row[2]}-${row[0]}`,
        userId: row[1] || '',
        userName: row[1] || 'Unknown',
        itemId: row[2] || '',
        itemName: row[4] || 'Unknown',
        itemType: row[3] || 'Video',
        playedAt: row[0] || new Date().toISOString(),
        duration: Math.max(0, duration),
        deviceName: row[7] || 'Unknown',
        clientName: row[6] || 'Unknown',
      });
    }
  }

  recentActivity.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

  return {
    recentActivity: recentActivity.slice(0, 50),
    userStats,
  };
}

// Fallback: estimate stats from the Items API (less accurate, no plugin needed)
async function getJellyfinStatsFromItems(serverUrl: string, apiKey: string): Promise<{
  recentActivity: ViewingActivity[];
  userStats: UserStats[];
}> {
  const usersRes = await fetch(`${serverUrl}/Users`, {
    headers: { 'X-MediaBrowser-Token': apiKey },
  });

  if (!usersRes.ok) return { recentActivity: [], userStats: [] };

  const users = await usersRes.json();
  const recentActivity: ViewingActivity[] = [];
  const userStatsMap = new Map<string, UserStats>();

  for (const user of users.slice(0, 20)) {
    userStatsMap.set(user.Id, {
      userId: user.Id,
      userName: user.Name,
      totalWatchTime: 0,
      itemsWatched: 0,
      lastActivity: '',
    });
  }

  const playedItemsResults = await Promise.all(
    users.slice(0, 20).map(async (user: Record<string, unknown>) => {
      try {
        let itemsBase: string;
        try {
          itemsBase = jellyfinUserUrl(serverUrl, String(user.Id), 'Items');
        } catch {
          return null;
        }
        const playedItemsRes = await fetch(
          `${itemsBase}?` + new URLSearchParams({
            limit: '200',
            sortBy: 'DatePlayed',
            sortOrder: 'Descending',
            includeItemTypes: 'Movie,Episode,Audio,Video,MusicVideo',
            recursive: 'true',
            isPlayed: 'true',
            enableUserData: 'true',
            fields: 'MediaSources',
          }).toString(),
          {
            headers: {
              'X-MediaBrowser-Token': apiKey,
              'Accept': 'application/json',
            },
          }
        );

        if (!playedItemsRes.ok) {
          console.error(`Failed to fetch played items for user ${user.Name}: ${playedItemsRes.status}`);
          return { user, items: [] };
        }

        const playedData = await playedItemsRes.json();
        return { user, items: playedData.Items || [] };
      } catch (error) {
        console.error(`Failed to fetch played items for user ${user.Name}:`, error);
        return { user, items: [] };
      }
    })
  );

  for (const { user, items } of playedItemsResults) {
    if (Array.isArray(items)) {
      for (const item of items) {
        const userData = item.UserData;
        if (!userData) continue;

        const playedDate = userData.LastPlayedDate;
        const playCount = userData.PlayCount || 1;
        let runtime = 0;

        if (item.RunTimeTicks) {
          runtime = Math.round(item.RunTimeTicks / 10000000);
        } else if (item.MediaSources && item.MediaSources.length > 0) {
          const mediaSource = item.MediaSources[0];
          runtime = Math.round((mediaSource.RunTimeTicks || 0) / 10000000);
        }

        recentActivity.push({
          id: `${item.Id}-${playedDate || Date.now()}`,
          userId: user.Id,
          userName: user.Name,
          itemId: item.Id,
          itemName: item.Name || 'Unknown',
          itemType: item.Type || 'Video',
          playedAt: playedDate || new Date().toISOString(),
          duration: runtime,
          deviceName: 'Unknown',
          clientName: item.Type || 'Unknown',
        });

        const stats = userStatsMap.get(user.Id);
        if (stats) {
          stats.totalWatchTime += runtime * playCount;
          stats.itemsWatched += playCount;
          if (playedDate && (!stats.lastActivity || new Date(playedDate) > new Date(stats.lastActivity))) {
            stats.lastActivity = playedDate;
          }
        }
      }
    }
  }

  recentActivity.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

  return {
    recentActivity: recentActivity.slice(0, 50),
    userStats: Array.from(userStatsMap.values()),
  };
}

// Try Playback Reporting plugin first, fall back to Items API
async function getJellyfinStats(serverUrl: string, apiKey: string): Promise<{
  recentActivity: ViewingActivity[];
  userStats: UserStats[];
}> {
  try {
    const pluginStats = await getJellyfinStatsFromPlugin(serverUrl, apiKey);
    if (pluginStats) return pluginStats;
  } catch {
    console.log('Playback Reporting plugin not available, falling back to Items API');
  }

  try {
    return await getJellyfinStatsFromItems(serverUrl, apiKey);
  } catch (error) {
    console.error('Failed to fetch Jellyfin stats:', error);
    return { recentActivity: [], userStats: [] };
  }
}

async function getPlexStats(serverUrl: string, token: string): Promise<{
  recentActivity: ViewingActivity[];
  userStats: UserStats[];
}> {
  try {
    const plexHeaders = {
      'X-Plex-Token': token,
      'Accept': 'application/json',
    };

    // Get users from plex.tv v2 API (v1 /api/users returns XML)
    const usersRes = await fetch('https://plex.tv/api/v2/friends', {
      headers: plexHeaders,
    });

    const userStatsMap = new Map<string, UserStats>();

    if (usersRes.ok) {
      const friends = await usersRes.json();
      const userList = Array.isArray(friends) ? friends : [];

      for (const user of userList) {
        const userId = String(user.id || '');
        const userName = user.title || user.username || 'Unknown';
        if (!userId) continue;

        userStatsMap.set(userId, {
          userId,
          userName,
          totalWatchTime: 0,
          itemsWatched: 0,
          lastActivity: '',
        });
      }
    }

    // Also add the server owner
    const identityRes = await fetch(`${serverUrl}/identity`, { headers: plexHeaders });
    if (identityRes.ok) {
      if (!userStatsMap.has('1')) {
        userStatsMap.set('1', {
          userId: '1',
          userName: 'Server Owner',
          totalWatchTime: 0,
          itemsWatched: 0,
          lastActivity: '',
        });
      }
    }

    // Get watch history from the local server
    const historyRes = await fetch(
      `${serverUrl}/status/sessions/history/all?X-Plex-Token=${token}`,
      { headers: plexHeaders }
    );

    const recentActivity: ViewingActivity[] = [];

    if (historyRes.ok) {
      const historyData = await historyRes.json();
      const entries = historyData?.MediaContainer?.Metadata || [];

      for (const entry of entries) {
        const accountId = String(entry.accountID || '');
        const viewedAt = entry.viewedAt ? new Date(entry.viewedAt * 1000).toISOString() : new Date().toISOString();
        const duration = entry.duration ? Math.round(entry.duration / 1000) : 0;
        const userName = userStatsMap.get(accountId)?.userName || `User ${accountId}`;

        recentActivity.push({
          id: `${entry.ratingKey}-${entry.viewedAt}`,
          userId: accountId,
          userName,
          itemId: entry.ratingKey || '',
          itemName: entry.grandparentTitle
            ? `${entry.grandparentTitle} - ${entry.title}`
            : entry.title || 'Unknown',
          itemType: entry.type || 'Video',
          playedAt: viewedAt,
          duration,
          deviceName: 'Unknown',
          clientName: 'Unknown',
        });

        // Update user stats
        const stats = userStatsMap.get(accountId);
        if (stats) {
          stats.totalWatchTime += duration;
          stats.itemsWatched += 1;
          if (!stats.lastActivity || viewedAt > stats.lastActivity) {
            stats.lastActivity = viewedAt;
          }
        }
      }
    }

    recentActivity.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

    return {
      recentActivity: recentActivity.slice(0, 50),
      userStats: Array.from(userStatsMap.values()),
    };
  } catch (error) {
    console.error('Failed to fetch Plex stats:', error);
    return { recentActivity: [], userStats: [] };
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    // Fire-and-forget: clean up expired auto-remove users (self-throttled to once/hour)
    runAutoRemoveIfDue().catch(logOnError('stats:auto-remove'));

    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');

    let server = null;

    if (serverId) {
      server = await prisma.server.findUnique({
        where: { id: serverId },
      }).then(s => s ? decryptServerSecrets(s) : null);
    } else {
      const servers = (await prisma.server.findMany({
        where: { isActive: true },
        take: 1,
      })).map(decryptServerSecrets);
      server = servers[0] || null;
    }

    if (!server) {
      return NextResponse.json({
        serverName: null,
        recentActivity: [] as ViewingActivity[],
        userStats: [] as UserStats[],
      });
    }

    let stats: { recentActivity: ViewingActivity[]; userStats: UserStats[] } = { recentActivity: [], userStats: [] };

    if (server.type === 'jellyfin' && server.apiKey) {
      stats = await getJellyfinStats(server.url, server.apiKey);
    } else if (server.type === 'plex' && server.token) {
      stats = await getPlexStats(server.url, server.token);
    }

    return NextResponse.json({
      serverName: server.name,
      serverType: server.type,
      ...stats,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { message: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}