import { NextRequest, NextResponse } from 'next/server';
import type { Server } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { decryptServerSecrets } from '@/lib/crypto';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const ip = getClientIp(_request);
    const rl = checkRateLimit(`invite-verify:${ip}`, RATE_LIMITS.inviteVerify);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const { code } = await params;

    const invite = await prisma.invite.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        server: true,
      },
    });

    if (!invite) {
      return NextResponse.json(
        { valid: false, message: 'Invalid invite code' },
        { status: 404 }
      );
    }

    if (invite.status !== 'active') {
      return NextResponse.json(
        { valid: false, message: 'This invite has expired or been cancelled' },
        { status: 400 }
      );
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      await prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      return NextResponse.json(
        { valid: false, message: 'This invite has expired' },
        { status: 400 }
      );
    }

    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
      return NextResponse.json(
        { valid: false, message: 'This invite has already been used' },
        { status: 400 }
      );
    }

    let libraryIds: string[] = [];
    try {
      libraryIds = JSON.parse(invite.libraries || '[]');
    } catch {
      libraryIds = [];
    }

    const libraries = await resolveLibraryNames(invite.server, libraryIds);

    const settings = await prisma.settings.findFirst({
      select: {
        preRegisterTitle: true,
        preRegisterSubtitle: true,
        preRegisterChecklist: true,
        requireInviteAcceptance: true,
        captchaEnabled: true,
      },
    });

    let preRegisterChecklist: string[] = [];
    try {
      preRegisterChecklist = settings?.preRegisterChecklist
        ? JSON.parse(settings.preRegisterChecklist)
        : [];
    } catch {
      preRegisterChecklist = [];
    }

    return NextResponse.json({
      valid: true,
      serverId: invite.serverId,
      serverType: invite.server?.type || 'plex',
      serverName: invite.server?.name || 'Media Server',
      libraries,
      accessUntil: invite.accessUntil?.toISOString() || null,
      accessDurationDays: invite.accessDurationDays,
      preRegisterTitle: settings?.preRegisterTitle || 'Before You Start',
      preRegisterSubtitle: settings?.preRegisterSubtitle || '',
      preRegisterChecklist,
      requireInviteAcceptance: settings?.requireInviteAcceptance || false,
      captchaEnabled: settings?.captchaEnabled || false,
      passphraseRequired: Boolean(invite.passphrase),
    });
  } catch (error) {
    console.error('Error verifying invite:', error);
    return NextResponse.json(
      { valid: false, message: 'Something went wrong' },
      { status: 500 }
    );
  }
}

// Map the stored library IDs on an invite to friendly names by hitting the
// media server. Failures are non-fatal — we fall back to showing the ID so the
// invite flow still renders.
async function resolveLibraryNames(server: Server | null, ids: string[]): Promise<string[]> {
  if (!server || ids.length === 0) return ids;
  try {
    const decrypted = decryptServerSecrets(server);
    const idToName = new Map<string, string>();

    if (decrypted.type === 'jellyfin' && decrypted.apiKey) {
      const res = await fetch(`${decrypted.url}/Library/VirtualFolders`, {
        headers: { 'X-MediaBrowser-Token': decrypted.apiKey, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach((lib: Record<string, unknown>, index: number) => {
            const name = (lib.Name as string) || (lib.name as string) || `Library ${index + 1}`;
            const itemId = (lib.ItemId as string) || `jellyfin-lib-${index}`;
            idToName.set(itemId, name);
          });
        }
      }
    } else if (decrypted.type === 'plex' && decrypted.token) {
      const res = await fetch(`${decrypted.url}/library/sections`, {
        headers: { 'X-Plex-Token': decrypted.token, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const directories = data?.MediaContainer?.Directory || [];
        const sections = Array.isArray(directories) ? directories : [directories];
        for (const section of sections) {
          if (!section) continue;
          const key = String(section.key || '');
          const title = section.title || `Library ${key}`;
          idToName.set(`plex-lib-${key}`, title);
        }
      }
    }

    return ids.map((id) => idToName.get(id) || id);
  } catch (err) {
    console.error('Failed to resolve library names:', err);
    return ids;
  }
}
