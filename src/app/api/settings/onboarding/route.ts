import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { onboardingContentSchema, validateBody } from '@/lib/validation';

export async function GET() {
  try {
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          serverName: 'Media Server',
          onboardingContent: JSON.stringify([]),
        },
      });
    }

    let content = [];
    try {
      content = JSON.parse(settings.onboardingContent || '[]');
    } catch {
      content = [];
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error fetching onboarding content:', error);
    return NextResponse.json(
      { message: 'Failed to fetch onboarding content' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(onboardingContentSchema, body);
    if (!parsed.success) return parsed.response;

    const { content } = parsed.data;

    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          onboardingContent: JSON.stringify(content),
        },
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          onboardingContent: JSON.stringify(content),
        },
      });
    }

    return NextResponse.json({ success: true, content });
  } catch (error) {
    console.error('Error updating onboarding content:', error);
    return NextResponse.json(
      { message: 'Failed to update onboarding content' },
      { status: 500 }
    );
  }
}
