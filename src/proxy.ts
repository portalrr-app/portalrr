import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that do NOT require an admin session at the middleware layer.
// Each route handler is still responsible for its own auth — most /api/account/*
// handlers authenticate the end user via the user_session cookie; public routes
// validate their own tokens (invite codes, reset tokens, captcha cookie, etc.).
// Do NOT add a route here unless you have confirmed the handler performs its
// own authentication or is genuinely public.
const ROUTES_BYPASSING_ADMIN_GATE = [
  // Genuinely unauthenticated
  '/api/invites/verify/',
  '/api/auth/register',
  '/api/admin/login',
  '/api/admin/setup',
  '/api/settings/public',
  '/api/settings/onboarding',
  '/api/account/login',
  '/api/account/reset-password',
  '/api/invite-requests',
  '/api/captcha',
  '/api/health',
  // User-session authenticated (admin_session not required; handler runs authenticateUser)
  '/api/account/logout',
  '/api/account/me',
  '/api/account/password',
  '/api/account/referrals',
];

function bypassesAdminGate(pathname: string): boolean {
  return ROUTES_BYPASSING_ADMIN_GATE.some((route) => pathname.startsWith(route));
}

function buildCsp(nonce: string, isDev: boolean): string {
  // script-src:
  //   'self' — own bundles
  //   'nonce-<nonce>' — allows the one static inline script in layout.tsx
  //   'strict-dynamic' — trust scripts that 'nonce-…'-tagged scripts load
  //   'unsafe-eval' (dev only) — React dev-only requires eval
  // style-src still allows 'unsafe-inline' because useAppearance.ts appends a
  // dynamically-built <style> element at runtime for the custom-css setting;
  // moving that to nonce-based style-src is future work.
  const parts = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    'upgrade-insecure-requests',
  ];
  return parts.join('; ');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isApi = pathname.startsWith('/api/');
  const isAdmin = pathname.startsWith('/admin');

  // CSRF protection for all state-changing API requests
  if (isApi) {
    const method = request.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');
      const host = request.headers.get('host');

      // Reject requests missing Host entirely — browsers always send one, so a
      // missing Host is either a misconfigured proxy or a crafted request.
      if (!host) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }

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

  // For non-admin, non-api routes (public pages like /, /register/*, /onboarding)
  // we still need to set a CSP with nonce. Fall through to the shared CSP block
  // below after running the auth checks for admin/api routes.
  if (isApi || isAdmin) {
    if (!(isApi && bypassesAdminGate(pathname))
        && pathname !== '/admin/login'
        && pathname !== '/admin/setup') {
      const sessionId = request.cookies.get('admin_session')?.value;
      if (!sessionId) {
        if (isAdmin) {
          return NextResponse.redirect(new URL('/admin/login', request.url));
        }
        return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
      }
    }
  }

  // API responses are JSON and don't render HTML, so CSP is not load-bearing
  // there — skip the nonce plumbing for them.
  if (isApi) {
    return NextResponse.next();
  }

  // Page request: generate a fresh nonce and attach CSP.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const csp = buildCsp(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Run on API and all page routes. Exclude Next's static asset pipeline and
  // prefetch requests — static assets don't need a CSP header and running the
  // proxy on them wastes compute.
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
