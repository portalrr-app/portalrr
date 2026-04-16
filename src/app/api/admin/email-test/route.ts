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
    console.error('SMTP test failed:', error);
    const code = (error as { code?: string })?.code;
    const userMessage = friendlySmtpError(code);
    return NextResponse.json(
      { success: false, message: userMessage, code: code || null },
      { status: 400 }
    );
  }
}

function friendlySmtpError(code: string | undefined): string {
  switch (code) {
    case 'EAUTH':
      return 'SMTP authentication failed — check username and password.';
    case 'ECONNECTION':
    case 'ECONNREFUSED':
      return 'SMTP connection refused — check host and port.';
    case 'ETIMEDOUT':
    case 'ETIME':
      return 'SMTP connection timed out — check host, port, and firewall rules.';
    case 'ENOTFOUND':
    case 'EDNS':
      return 'SMTP host could not be resolved — check the hostname.';
    case 'ESOCKET':
      return 'SMTP socket error — check TLS settings for this port.';
    case 'EENVELOPE':
      return 'SMTP rejected the sender or recipient address.';
    default:
      return 'SMTP test failed. See server logs for details.';
  }
}
