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
      return NextResponse.json([]);
    }

    const libraries: { id: string; name: string; type: string }[] = [];

    if (server.type === 'jellyfin' && server.apiKey) {
      try {
        const response = await fetch(`${server.url}/Library/VirtualFolders`, {
          headers: {
            'X-MediaBrowser-Token': server.apiKey,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            data.forEach((lib: Record<string, unknown>, index: number) => {
              const name = (lib.Name as string) || (lib.name as string) || `Library ${index + 1}`;
              const itemId = (lib.ItemId as string) || `jellyfin-lib-${index}`;
              libraries.push({
                id: itemId,
                name,
                type: 'jellyfin',
              });
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch Jellyfin libraries:', error);
      }
    } else if (server.type === 'plex' && server.token) {
      try {
        const response = await fetch(`${server.url}/library/sections`, {
          headers: {
            'X-Plex-Token': server.token,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const directories = data?.MediaContainer?.Directory || [];
          const sections = Array.isArray(directories) ? directories : [directories];

          for (const section of sections) {
            if (!section) continue;
            const key = String(section.key || '');
            const title = section.title || `Library ${key}`;
            const type = section.type || 'video';
            libraries.push({
              id: `plex-lib-${key}`,
              name: title,
              type,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch Plex libraries:', error);
      }
    }

    return NextResponse.json(libraries);
  } catch (error) {
    console.error('Error fetching libraries:', error);
    return NextResponse.json(
      { message: 'Failed to fetch libraries' },
      { status: 500 }
    );
  }
}
