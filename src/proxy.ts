import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public API routes that do NOT require admin authentication
const PUBLIC_API_ROUTES = [
  '/api/invites/verify/',
  '/api/auth/register',
  '/api/admin/login',
  '/api/admin/setup',
  '/api/settings/public',
  '/api/settings/onboarding',
  '/api/account/login',
  '/api/account/logout',
  '/api/account/me',
  '/api/account/password',
  '/api/account/referrals',
  '/api/account/reset-password',
  '/api/invite-requests',
  '/api/captcha',
  '/api/health',
];

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isApi = pathname.startsWith('/api/');
  const isAdmin = pathname.startsWith('/admin');

  // Don't touch public pages or non-admin routes
  if (!isApi && !isAdmin) {
    return NextResponse.next();
  }

  // CSRF protection for all state-changing API requests
  if (isApi) {
    const method = request.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');
      const host = request.headers.get('host');

      if (host) {
        let originValid = false;
        if (origin) {
          try { originValid = new URL(origin).host === host; } catch {}
          if (!originValid) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
          }
        } else if (referer) {
          try { originValid = new URL(referer).host === host; } catch {}
          if (!originValid) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
          }
        } else {
          // No Origin or Referer — browsers always send one for same-origin requests
          return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }
      }
    }
  }

  // Allow public API routes
  if (isApi && isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  // Allow admin login page itself (but not the API)
  if (pathname === '/admin/login' || pathname === '/admin/setup') {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionId = request.cookies.get('admin_session')?.value;

  if (!sessionId) {
    if (isAdmin) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  // Cookie exists — let the route handler do full DB validation
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*'],
};
