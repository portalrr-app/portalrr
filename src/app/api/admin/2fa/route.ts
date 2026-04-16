import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSecret, generateURI, verify } from 'otplib';
import { validateSession } from '@/lib/auth/session';
import { encrypt, decrypt } from '@/lib/crypto';
import bcrypt from 'bcryptjs';

/**
 * Start enrolment for a new TOTP secret.
 *
 * Changed from GET → POST:
 *   - The endpoint writes to the Admin row (rotates totpSecret) so it is not
 *     safe as an idempotent GET; POST is also CSRF-protected by the proxy
 *     Origin/Referer check, which defends against drive-by secret rotation
 *     from an authenticated admin's browser.
 *
 * Refuses to re-key if 2FA is already enabled — the admin must DELETE (which
 * requires TOTP code or password) to disable first, preventing silent secret
 * replacement if a session cookie is stolen.
 */
export async function POST(request: NextRequest) {
  try {
    const result = await validateSession(request);
    if (!result) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (result.admin.totpEnabled) {
      return NextResponse.json(
        { message: '2FA is already enabled. Disable it first before re-enrolling.' },
        { status: 409 }
      );
    }

    const secret = generateSecret();
    const uri = generateURI({
      secret,
      label: result.admin.username,
      issuer: 'Portalrr',
    });
    // Store the secret in the database immediately, but keep 2FA disabled
    // until the user verifies with a valid TOTP code.
    await prisma.admin.update({
      where: { id: result.admin.id },
      data: { totpSecret: encrypt(secret), totpEnabled: false },
    });
    // Return the otpauth URI directly so the frontend can generate the QR code
    // locally — never send the TOTP secret to a third-party service.
    return NextResponse.json({
      secret,
      otpauthUri: uri,
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json({ message: 'Failed to setup 2FA' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await validateSession(request);
    if (!result) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { token, password } = body;

    if (!token && !password) {
      return NextResponse.json(
        { message: 'Must provide either a TOTP code or password to disable 2FA' },
        { status: 400 }
      );
    }

    // Verify with TOTP code
    if (token) {
      if (!result.admin.totpSecret) {
        return NextResponse.json({ message: '2FA is not enabled' }, { status: 400 });
      }
      const secret = decrypt(result.admin.totpSecret);
      const isValid = verify({ token, secret });
      if (!isValid) {
        return NextResponse.json({ message: 'Invalid TOTP code' }, { status: 403 });
      }
    // Verify with password
    } else if (password) {
      const isValid = await bcrypt.compare(password, result.admin.passwordHash);
      if (!isValid) {
        return NextResponse.json({ message: 'Invalid password' }, { status: 403 });
      }
    }

    await prisma.admin.update({
      where: { id: result.admin.id },
      data: { totpSecret: null, totpEnabled: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('2FA disable error:', error);
    return NextResponse.json({ message: 'Failed to disable 2FA' }, { status: 500 });
  }
}
