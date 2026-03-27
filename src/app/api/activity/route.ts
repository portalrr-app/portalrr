import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { decryptServerSecrets } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');
    const type = searchParams.get('type') || 'all'; // 'streams', 'log', 'all'

    const rawServer = serverId
      ? await prisma.server.findUnique({ where: { id: serverId } })
      : await prisma.server.findFirst({ where: { isActive: true } });
    const server = rawServer ? decryptServerSecrets(rawServer) : null;

    if (!server) {
      return NextResponse.json({ streams: [], log: [], server: null });
    }

    if (server.type !== 'jellyfin' || !server.apiKey) {
      return NextResponse.json({
        streams: [],
        log: [],
        server: { id: server.id, name: server.name, type: server.type },
        message: 'Activity tracking only available for Jellyfin servers',
      });
    }

    const results: { streams?: unknown[]; log?: { entries: unknown[]; total: number; startIndex: number; limit: number } } = {};

    if (type === 'streams' || type === 'all') {
      results.streams = await fetchSessions(server.url, server.apiKey);
    }

    if (type === 'log' || type === 'all') {
      const limit = parseInt(searchParams.get('limit') || '50');
      const startIndex = parseInt(searchParams.get('startIndex') || '0');
      results.log = await fetchActivityLog(server.url, server.apiKey, startIndex, limit);
    }

    return NextResponse.json({
      ...results,
      server: { id: server.id, name: server.name, type: server.type },
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { message: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}

interface JellyfinSession {
  Id: string;
  UserId: string;
  UserName: string;
  Client: string;
  DeviceName: string;
  LastActivityDate: string;
  NowPlayingItem?: {
    Name: string;
    SeriesName?: string;
    Type: string;
    RunTimeTicks: number;
    ParentIndexNumber?: number;
    IndexNumber?: number;
    ProductionYear?: number;
    ImageTags?: Record<string, string>;
    Id?: string;
  };
  PlayState?: {
    PositionTicks: number;
    IsPaused: boolean;
    IsMuted: boolean;
    PlayMethod?: string;
  };
  TranscodingInfo?: {
    IsVideoDirect: boolean;
    IsAudioDirect: boolean;
    VideoCodec?: string;
    AudioCodec?: string;
    Bitrate?: number;
  };
}

async function fetchSessions(serverUrl: string, apiKey: string) {
  try {
    const res = await fetch(`${serverUrl}/Sessions`, {
      headers: { 'X-MediaBrowser-Token': apiKey },
    });
    if (!res.ok) return [];

    const sessions: JellyfinSession[] = await res.json();

    return sessions
      .filter(s => s.NowPlayingItem) // Only active streams
      .map(s => {
        const item = s.NowPlayingItem!;
        const playState = s.PlayState;
        const progress = playState && item.RunTimeTicks
          ? Math.round((playState.PositionTicks / item.RunTimeTicks) * 100)
          : 0;

        let title = item.Name;
        if (item.SeriesName) {
          const season = item.ParentIndexNumber ? `S${String(item.ParentIndexNumber).padStart(2, '0')}` : '';
          const episode = item.IndexNumber ? `E${String(item.IndexNumber).padStart(2, '0')}` : '';
          title = `${item.SeriesName} - ${season}${episode} - ${item.Name}`;
        }

        return {
          sessionId: s.Id,
          userId: s.UserId,
          username: s.UserName,
          client: s.Client,
          device: s.DeviceName,
          title,
          type: item.Type,
          year: item.ProductionYear,
          progress,
          isPaused: playState?.IsPaused || false,
          playMethod: s.TranscodingInfo
            ? (s.TranscodingInfo.IsVideoDirect ? 'Direct Play' : 'Transcode')
            : 'Direct Play',
          transcodingInfo: s.TranscodingInfo ? {
            videoCodec: s.TranscodingInfo.VideoCodec,
            audioCodec: s.TranscodingInfo.AudioCodec,
            bitrate: s.TranscodingInfo.Bitrate,
          } : null,
          imageId: item.Id,
        };
      });
  } catch (err) {
    console.error('Failed to fetch sessions:', err);
    return [];
  }
}

interface ActivityLogEntry {
  Id: number;
  Date: string;
  Type: string;
  UserId?: string;
  Name: string;
  ShortOverview?: string;
  Severity: string;
}

async function fetchActivityLog(serverUrl: string, apiKey: string, startIndex: number, limit: number): Promise<{ entries: unknown[]; total: number; startIndex: number; limit: number }> {
  try {
    const res = await fetch(
      `${serverUrl}/System/ActivityLog/Entries?startIndex=${startIndex}&limit=${limit}`,
      { headers: { 'X-MediaBrowser-Token': apiKey } }
    );
    if (!res.ok) return { entries: [], total: 0, startIndex, limit };

    const data = await res.json();
    const entries: ActivityLogEntry[] = data.Items || [];
    const totalRecordCount = data.TotalRecordCount || 0;

    return {
      entries: entries.map(e => ({
        id: e.Id,
        date: e.Date,
        type: e.Type,
        userId: e.UserId,
        name: e.Name,
        overview: e.ShortOverview,
        severity: e.Severity,
      })),
      total: totalRecordCount,
      startIndex,
      limit,
    };
  } catch (err) {
    console.error('Failed to fetch activity log:', err);
    return { entries: [], total: 0, startIndex, limit };
  }
}
