import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { createInviteSchema, validateBody } from '@/lib/validation';
import { Prisma } from '@prisma/client';
import { generateInviteCode, generatePinCode } from '@/lib/crypto';
import bcrypt from 'bcryptjs';
import { dispatchWebhook } from '@/lib/notifications/webhooks';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(createInviteSchema, body);
    if (!parsed.success) return parsed.response;

    const {
      serverId,
      maxUses,
      expiresInDays,
      accessDurationDays,
      autoRemove,
      libraries,
      createdBy,
      codeType,
      pinLength,
      customCode,
      label,
      passphrase,
      notifyOnUse,
      notifyOnExpiry,
    } = parsed.data;

    // Enforce maxInvites setting
    const settings = await prisma.settings.findFirst({ select: { maxInvites: true } });
    if (settings?.maxInvites && settings.maxInvites > 0) {
      const activeCount = await prisma.invite.count({ where: { status: 'active' } });
      if (activeCount >= settings.maxInvites) {
        return NextResponse.json(
          { message: `Maximum active invites limit reached (${settings.maxInvites})` },
          { status: 400 }
        );
      }
    }

    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return NextResponse.json(
        { message: 'Server not found' },
        { status: 400 }
      );
    }

    let expiresAt = null;
    if (expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Hash passphrase if provided
    let passphraseHash = null;
    if (passphrase) {
      passphraseHash = await bcrypt.hash(passphrase, 12);
    }

    // Determine code generation strategy based on codeType
    const isCustom = codeType === 'custom' && customCode;
    const maxRetries = isCustom ? 1 : 5;
    let invite = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let code: string;
      if (isCustom) {
        code = customCode.toUpperCase();
      } else if (codeType === 'pin') {
        code = generatePinCode(pinLength);
      } else {
        code = generateInviteCode();
      }

      try {
        invite = await prisma.invite.create({
          data: {
            code,
            serverId,
            maxUses,
            expiresAt,
            accessDurationDays,
            autoRemove,
            libraries: JSON.stringify(libraries),
            status: 'active',
            createdBy: createdBy || 'admin',
            label: label || null,
            passphrase: passphraseHash,
            notifyOnUse,
            notifyOnExpiry,
          },
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          if (attempt === maxRetries - 1) {
            return NextResponse.json(
              { message: 'Failed to generate unique invite code after multiple attempts' },
              { status: 500 }
            );
          }
          continue;
        }
        throw error;
      }
    }

    if (!invite) {
      return NextResponse.json(
        { message: 'Failed to create invite' },
        { status: 500 }
      );
    }

    dispatchWebhook('invite.created', { code: invite.code, serverId: invite.serverId, maxUses: invite.maxUses, createdBy: invite.createdBy });

    return NextResponse.json({
      id: invite.id,
      code: invite.code,
      serverId: invite.serverId,
      libraries: libraries,
      expiresAt: invite.expiresAt?.toISOString() || null,
      accessDurationDays: invite.accessDurationDays,
      autoRemove: invite.autoRemove,
      maxUses: invite.maxUses,
      status: invite.status,
    });
  } catch (error) {
    console.error('Error creating invite:', error);
    return NextResponse.json(
      { message: 'Failed to create invite' },
      { status: 500 }
    );
  }
}
