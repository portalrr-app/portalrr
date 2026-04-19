import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runAutoRemoveIfDue } from '@/lib/auto-remove';
import { logOnError } from '@/lib/logger';

export async function GET(_request: NextRequest) {
  // Fire-and-forget: check for expired users to auto-remove (self-throttled to 1/hour)
  runAutoRemoveIfDue().catch(logOnError('settings/public:auto-remove'));
  try {
    const settings = await prisma.settings.findFirst({
      select: {
        serverName: true,
        accentColor: true,
        themeVersion: true,
        customCss: true,
        appName: true,
        logoUrl: true,
        logoMode: true,
        subtitleText: true,
        backgroundStyle: true,
        backgroundImageUrl: true,
        backgroundOverlay: true,
        cardStyle: true,
        borderRadius: true,
        welcomeTitle: true,
        registerTitle: true,
        footerText: true,
        hideAdminLink: true,
        cardWidth: true,
        fontFamily: true,
        fontDisplay: true,
        buttonStyle: true,
        inputStyle: true,
        enableAnimations: true,
        enableNoise: true,
        gradientDirection: true,
        buttonText: true,
        registerButtonText: true,
        inviteRequestsEnabled: true,
        inviteRequestMessage: true,
        passwordMinLength: true,
        passwordRequireUppercase: true,
        passwordRequireNumber: true,
        passwordRequireSpecial: true,
        emailEnabled: true,
        referralInvitesEnabled: true,
        onboardingTitle: true,
        onboardingSubtitle: true,
        onboardingButtonText: true,
        onboardingButtonUrl: true,
        onboardingParticleStyle: true,
        onboardingParticleIntensity: true,
        onboardingParticleCursor: true,
        onboardingLayout: true,
        onboardingTransition: true,
        onboardingGlass: true,
      },
    });

    const response = NextResponse.json(settings || {}, {
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (settings?.accentColor) {
      response.cookies.set('accent_color', JSON.stringify({ color: settings.accentColor, ver: settings.themeVersion }), {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
      });
    }

    return response;
  } catch (error) {
    console.error('Error fetching public settings:', error);
    return NextResponse.json({}, { status: 500 });
  }
}
