import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const result = await validateSession(request);
    if (!result) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      totpEnabled: result.admin.totpEnabled || false,
    });
  } catch (error) {
    console.error('2FA status error:', error);
    return NextResponse.json({ message: 'Failed to get 2FA status' }, { status: 500 });
  }
}