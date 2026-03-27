import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

async function getMailer() {
  const settings = await prisma.settings.findFirst();
  if (!settings?.emailEnabled || !settings.smtpHost || !settings.smtpPort || !settings.smtpFrom) {
    return null;
  }

  const smtpPass = settings.smtpPass ? decrypt(settings.smtpPass) : null;

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: settings.smtpUser && smtpPass
      ? {
          user: settings.smtpUser,
          pass: smtpPass,
        }
      : undefined,
  });

  return { transporter, settings };
}

export async function sendEmail(to: string, subject: string, text: string) {
  const mailer = await getMailer();
  if (!mailer) return false;

  await mailer.transporter.sendMail({
    from: mailer.settings.smtpFrom!,
    to,
    subject,
    text,
  });

  return true;
}
