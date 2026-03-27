import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { updateEmailTemplateSchema, validateBody } from '@/lib/validation';
import { getAllTemplates, getTemplateVariables, renderTemplate } from '@/lib/notifications/email-templates';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const templates = await getAllTemplates();
    const variables = getTemplateVariables();

    return NextResponse.json({ templates, variables });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    return NextResponse.json(
      { message: 'Failed to fetch email templates' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const validation = validateBody(updateEmailTemplateSchema, body);
    if (!validation.success) return validation.response;

    const { eventType, subject, body: templateBody, enabled } = validation.data;

    const { searchParams } = new URL(request.url);
    const preview = searchParams.get('preview') === 'true';

    if (preview) {
      // Render with sample data and return preview without saving
      const variables = getTemplateVariables();
      const eventVars = variables[eventType] || [];
      const sampleData: Record<string, string> = {};
      for (const v of eventVars) {
        sampleData[v] = `[${v}]`;
      }
      // Provide recognisable sample values for common variables
      sampleData.appName = 'Portalrr';
      sampleData.serverName = 'My Media Server';
      sampleData.username = 'JaneDoe';
      sampleData.email = 'jane@example.com';
      sampleData.code = 'ABC123';

      const renderedSubject = renderTemplate(subject, sampleData);
      const renderedBody = renderTemplate(templateBody, sampleData);

      return NextResponse.json({
        subject: renderedSubject,
        body: renderedBody,
      });
    }

    const template = await prisma.emailTemplate.upsert({
      where: { eventType },
      create: {
        eventType,
        subject,
        body: templateBody,
        enabled: enabled ?? true,
      },
      update: {
        subject,
        body: templateBody,
        enabled: enabled ?? undefined,
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error updating email template:', error);
    return NextResponse.json(
      { message: 'Failed to update email template' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { eventType } = body;

    if (!eventType || typeof eventType !== 'string') {
      return NextResponse.json(
        { message: 'eventType is required' },
        { status: 400 }
      );
    }

    await prisma.emailTemplate.deleteMany({
      where: { eventType },
    });

    return NextResponse.json({ message: 'Template reset to default' });
  } catch (error) {
    console.error('Error resetting email template:', error);
    return NextResponse.json(
      { message: 'Failed to reset email template' },
      { status: 500 }
    );
  }
}
