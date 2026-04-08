import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { decrypt } from '@/lib/crypto';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, recipientEmail } = body;

    if (!smtpHost || !smtpPort || !smtpFrom) {
      return NextResponse.json(
        { message: 'SMTP host, port, and from address are required' },
        { status: 400 }
      );
    }

    // Determine password: use provided value, or fall back to saved one from DB
    let password: string | null = null;
    if (smtpPass) {
      password = smtpPass;
    } else {
      // No password provided — use the stored one
      const settings = await prisma.settings.findFirst({ select: { smtpPass: true } });
      if (settings?.smtpPass) {
        try {
          password = decrypt(settings.smtpPass);
        } catch {
          password = settings.smtpPass;
        }
      }
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: smtpUser && password
        ? { user: smtpUser, pass: password }
        : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // First verify the connection
    await transporter.verify();

    // If a recipient email is provided, send a test email
    if (recipientEmail) {
      await transporter.sendMail({
        from: smtpFrom,
        to: recipientEmail,
        subject: 'Portalrr SMTP Test',
        text: 'This is a test email from Portalrr. If you received this, your SMTP configuration is working correctly.',
      });
      return NextResponse.json({ success: true, message: 'Test email sent successfully' });
    }

    return NextResponse.json({ success: true, message: 'SMTP connection verified successfully' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('SMTP test failed:', msg);
    return NextResponse.json(
      { success: false, message: `SMTP test failed: ${msg}` },
      { status: 400 }
    );
  }
}
