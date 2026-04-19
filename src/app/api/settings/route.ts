import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { updateSettingsSchema, validateBody } from '@/lib/validation';
import { encrypt } from '@/lib/crypto';
import { sanitizeCss, stripHtml } from '@/lib/sanitize';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          serverName: 'Media Server',
          accentColor: '#A78BFA',
          inviteExpiryDays: 7,
          maxInvites: 100,
          onboardingContent: JSON.stringify([]),
        },
      });
    }

    const { smtpPass, jellyseerrApiKey, discordBotToken, telegramBotToken, ...publicSettings } = settings;
    return NextResponse.json({
      ...publicSettings,
      hasJellyseerrApiKey: Boolean(jellyseerrApiKey),
      hasSmtpPass: Boolean(smtpPass),
      hasDiscordBotToken: Boolean(discordBotToken),
      hasTelegramBotToken: Boolean(telegramBotToken),
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { message: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();

    // All admins (local and media server) can modify all settings
    const parsed = validateBody(updateSettingsSchema, body);
    if (!parsed.success) return parsed.response;

    let settings = await prisma.settings.findFirst();

    const data = parsed.data;

    // Sanitize text fields to prevent stored XSS
    const textFields = ['serverName', 'appName', 'welcomeTitle', 'registerTitle', 'subtitleText', 'footerText',
      'preRegisterTitle', 'preRegisterSubtitle', 'inviteRequestMessage', 'onboardingTitle', 'onboardingSubtitle',
      'buttonText', 'registerButtonText', 'onboardingButtonText'] as const;
    for (const field of textFields) {
      if (typeof data[field] === 'string') {
        (data as Record<string, unknown>)[field] = stripHtml(data[field] as string);
      }
    }

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          serverName: data.serverName || 'Media Server',
          inviteExpiryDays: data.inviteExpiryDays || 7,
          maxInvites: data.maxInvites || 100,
          customCss: data.customCss ? sanitizeCss(data.customCss) : data.customCss,
          accentColor: data.accentColor || '#A78BFA',
        },
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          serverName: data.serverName ?? settings.serverName,
          inviteExpiryDays: data.inviteExpiryDays ?? settings.inviteExpiryDays,
          maxInvites: data.maxInvites ?? settings.maxInvites,
          inviteProfiles: data.inviteProfiles ?? settings.inviteProfiles,
          preRegisterTitle: data.preRegisterTitle ?? settings.preRegisterTitle,
          preRegisterSubtitle: data.preRegisterSubtitle ?? settings.preRegisterSubtitle,
          preRegisterChecklist: data.preRegisterChecklist ?? settings.preRegisterChecklist,
          requireInviteAcceptance: data.requireInviteAcceptance ?? settings.requireInviteAcceptance,
          captchaEnabled: data.captchaEnabled ?? settings.captchaEnabled,
          customCss: data.customCss !== undefined ? (data.customCss ? sanitizeCss(data.customCss) : data.customCss) : settings.customCss,
          emailEnabled: data.emailEnabled ?? settings.emailEnabled,
          smtpHost: data.smtpHost !== undefined ? data.smtpHost : settings.smtpHost,
          smtpPort: data.smtpPort !== undefined ? data.smtpPort : settings.smtpPort,
          smtpUser: data.smtpUser !== undefined ? data.smtpUser : settings.smtpUser,
          smtpPass: data.smtpPass !== undefined ? (data.smtpPass ? encrypt(data.smtpPass) : null) : settings.smtpPass,
          smtpFrom: data.smtpFrom !== undefined ? data.smtpFrom : settings.smtpFrom,
          notifyBeforeExpiryDays: data.notifyBeforeExpiryDays ?? settings.notifyBeforeExpiryDays,
          notifyOnExpiry: data.notifyOnExpiry ?? settings.notifyOnExpiry,
          expiryPolicy: data.expiryPolicy ?? settings.expiryPolicy,
          expiryDeleteAfterDays: data.expiryDeleteAfterDays ?? settings.expiryDeleteAfterDays,
          referralInvitesEnabled: data.referralInvitesEnabled ?? settings.referralInvitesEnabled,
          referralMaxUses: data.referralMaxUses ?? settings.referralMaxUses,
          referralExpiresInDays: data.referralExpiresInDays ?? settings.referralExpiresInDays,
          referralAccessDurationDays: data.referralAccessDurationDays ?? settings.referralAccessDurationDays,
          referralAutoRemove: data.referralAutoRemove ?? settings.referralAutoRemove,
          accentColor: data.accentColor ?? settings.accentColor,
          themeVersion: data.accentColor !== undefined && data.accentColor !== settings.accentColor 
            ? { increment: 1 } 
            : settings.themeVersion,
          appName: data.appName ?? settings.appName,
          logoUrl: data.logoUrl !== undefined ? data.logoUrl : settings.logoUrl,
          logoMode: data.logoMode ?? settings.logoMode,
          subtitleText: data.subtitleText ?? settings.subtitleText,
          backgroundStyle: data.backgroundStyle ?? settings.backgroundStyle,
          backgroundImageUrl: data.backgroundImageUrl !== undefined ? data.backgroundImageUrl : settings.backgroundImageUrl,
          backgroundOverlay: data.backgroundOverlay ?? settings.backgroundOverlay,
          cardStyle: data.cardStyle ?? settings.cardStyle,
          borderRadius: data.borderRadius ?? settings.borderRadius,
          welcomeTitle: data.welcomeTitle ?? settings.welcomeTitle,
          registerTitle: data.registerTitle ?? settings.registerTitle,
          footerText: data.footerText !== undefined ? data.footerText : settings.footerText,
          hideAdminLink: data.hideAdminLink ?? settings.hideAdminLink,
          cardWidth: data.cardWidth ?? settings.cardWidth,
          fontFamily: data.fontFamily ?? settings.fontFamily,
          fontDisplay: data.fontDisplay ?? settings.fontDisplay,
          buttonStyle: data.buttonStyle ?? settings.buttonStyle,
          inputStyle: data.inputStyle ?? settings.inputStyle,
          enableAnimations: data.enableAnimations ?? settings.enableAnimations,
          enableNoise: data.enableNoise ?? settings.enableNoise,
          gradientDirection: data.gradientDirection ?? settings.gradientDirection,
          buttonText: data.buttonText ?? settings.buttonText,
          registerButtonText: data.registerButtonText ?? settings.registerButtonText,
          onboardingTitle: data.onboardingTitle ?? settings.onboardingTitle,
          onboardingSubtitle: data.onboardingSubtitle ?? settings.onboardingSubtitle,
          onboardingButtonText: data.onboardingButtonText ?? settings.onboardingButtonText,
          onboardingButtonUrl: data.onboardingButtonUrl ?? settings.onboardingButtonUrl,
          onboardingParticleStyle: data.onboardingParticleStyle ?? settings.onboardingParticleStyle,
          onboardingParticleIntensity: data.onboardingParticleIntensity ?? settings.onboardingParticleIntensity,
          onboardingParticleCursor: data.onboardingParticleCursor ?? settings.onboardingParticleCursor,
          onboardingLayout: data.onboardingLayout ?? settings.onboardingLayout,
          onboardingTransition: data.onboardingTransition ?? settings.onboardingTransition,
          onboardingGlass: data.onboardingGlass ?? settings.onboardingGlass,
          jellyseerrUrl: data.jellyseerrUrl !== undefined ? data.jellyseerrUrl : settings.jellyseerrUrl,
          jellyseerrApiKey: data.jellyseerrApiKey !== undefined ? (data.jellyseerrApiKey ? encrypt(data.jellyseerrApiKey) : null) : settings.jellyseerrApiKey,
          mediaServerAuth: data.mediaServerAuth ?? settings.mediaServerAuth,
          passwordMinLength: data.passwordMinLength ?? settings.passwordMinLength,
          passwordRequireUppercase: data.passwordRequireUppercase ?? settings.passwordRequireUppercase,
          passwordRequireNumber: data.passwordRequireNumber ?? settings.passwordRequireNumber,
          passwordRequireSpecial: data.passwordRequireSpecial ?? settings.passwordRequireSpecial,
          welcomeEmailEnabled: data.welcomeEmailEnabled ?? settings.welcomeEmailEnabled,
          inviteRequestsEnabled: data.inviteRequestsEnabled ?? settings.inviteRequestsEnabled,
          inviteRequestMessage: data.inviteRequestMessage ?? settings.inviteRequestMessage,
          inviteRequestServerId: data.inviteRequestServerId !== undefined ? data.inviteRequestServerId : settings.inviteRequestServerId,
          // Discord bot
          discordBotToken: data.discordBotToken !== undefined ? (data.discordBotToken ? encrypt(data.discordBotToken) : null) : settings.discordBotToken,
          discordGuildId: data.discordGuildId !== undefined ? (data.discordGuildId || null) : settings.discordGuildId,
          discordNotifyChannelId: data.discordNotifyChannelId !== undefined ? (data.discordNotifyChannelId || null) : settings.discordNotifyChannelId,
          discordRoleId: data.discordRoleId !== undefined ? (data.discordRoleId || null) : settings.discordRoleId,
          discordBotEnabled: data.discordBotEnabled ?? settings.discordBotEnabled,
          // Telegram bot
          telegramBotToken: data.telegramBotToken !== undefined ? (data.telegramBotToken ? encrypt(data.telegramBotToken) : null) : settings.telegramBotToken,
          telegramChatId: data.telegramChatId !== undefined ? data.telegramChatId : settings.telegramChatId,
          telegramBotEnabled: data.telegramBotEnabled ?? settings.telegramBotEnabled,
        },
      });
    }

    const { smtpPass, jellyseerrApiKey, discordBotToken, telegramBotToken, ...publicSettings } = settings;
    return NextResponse.json({
      ...publicSettings,
      hasJellyseerrApiKey: Boolean(jellyseerrApiKey),
      hasSmtpPass: Boolean(smtpPass),
      hasDiscordBotToken: Boolean(discordBotToken),
      hasTelegramBotToken: Boolean(telegramBotToken),
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { message: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
