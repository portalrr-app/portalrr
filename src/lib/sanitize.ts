/**
 * Sanitization utilities for user-supplied content.
 */

/**
 * Strip dangerous CSS constructs that could be used for data exfiltration or code execution.
 * Blocks: @import, expression(), -moz-binding, behavior:, url() with external/data/javascript URIs
 */
export function sanitizeCss(css: string): string {
  // Remove @import rules (data exfiltration via external stylesheets)
  let sanitized = css.replace(/@import\s+[^;]+;?/gi, '/* @import removed */');

  // Remove expression() (IE code execution)
  sanitized = sanitized.replace(/expression\s*\(/gi, '/* expression removed */(');

  // Remove -moz-binding (Firefox XBL injection)
  sanitized = sanitized.replace(/-moz-binding\s*:/gi, '/* -moz-binding removed */:');

  // Remove behavior: (IE HTC injection)
  sanitized = sanitized.replace(/behavior\s*:/gi, '/* behavior removed */:');

  // Remove url() with javascript:, data:, or external http(s) URIs
  // Allow url() with relative paths and # references (for SVG filters etc.)
  sanitized = sanitized.replace(
    /url\s*\(\s*['"]?\s*(javascript:|data:|https?:\/\/)/gi,
    'url(/* blocked: $1'
  );

  return sanitized;
}

/**
 * Strip HTML/script tags from a string to prevent stored XSS.
 * Use for fields that should be plain text (serverName, etc).
 */
export function stripHtml(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?(script|iframe|object|embed|link|meta|style|form|input|button|textarea|svg|math)\b[^>]*>/gi, '')
    .replace(/on\w+\s*=\s*(['"])[^'"]*\1/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '');
}

// Private IP ranges and reserved addresses to block for SSRF prevention
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,    // link-local / cloud metadata
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,              // IPv6 loopback
  /^\[?fe80:/i,               // IPv6 link-local
  /^\[?fc00:/i,               // IPv6 unique local
  /^\[?fd/i,                  // IPv6 unique local
];

/**
 * Check if a URL targets a private/internal network address.
 * Returns true if the URL is safe (public), false if it targets internal/private networks.
 */
export function isPublicUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;

    for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
      if (pattern.test(hostname)) return false;
    }

    // Block numeric IPs that resolve to private ranges (handles octal/hex encoding tricks)
    // e.g., 0x7f000001 = 127.0.0.1, 2130706433 = 127.0.0.1
    if (/^\d+$/.test(hostname)) {
      // Single decimal number — could be a packed IP
      const num = parseInt(hostname, 10);
      if (isPrivateIpNum(num)) return false;
    }

    if (/^0x[0-9a-f]+$/i.test(hostname)) {
      const num = parseInt(hostname, 16);
      if (isPrivateIpNum(num)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a URL is acceptable as a media-server endpoint.
 *
 * Plex/Jellyfin are typically reachable over LAN/docker networks, so we cannot
 * reject private IPs outright (as we do for webhook URLs). We *do* block the
 * cloud-metadata link-local range (169.254.0.0/16) and the 0.0.0.0 wildcard,
 * both of which have no legitimate use case for a media server and are the
 * highest-value SSRF targets if an admin session is compromised.
 */
export function isAllowedServerUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    const hostname = url.hostname.toLowerCase();

    // Link-local / cloud metadata (AWS/Azure/GCP IMDS)
    if (/^169\.254\.\d+\.\d+$/.test(hostname)) return false;
    if (/^\[?fe80:/i.test(hostname)) return false;

    // All-zeros wildcard
    if (hostname === '0.0.0.0' || hostname === '::' || hostname === '[::]') return false;

    // Reject packed-integer / hex obfuscation of blocked ranges
    if (/^\d+$/.test(hostname)) {
      const num = parseInt(hostname, 10);
      if (num >>> 16 === 0xA9FE || num === 0) return false;
    }
    if (/^0x[0-9a-f]+$/i.test(hostname)) {
      const num = parseInt(hostname, 16);
      if (num >>> 16 === 0xA9FE || num === 0) return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isPrivateIpNum(num: number): boolean {
  if (num < 0 || num > 0xFFFFFFFF) return true; // invalid
  // 127.0.0.0/8
  if ((num >>> 24) === 127) return true;
  // 10.0.0.0/8
  if ((num >>> 24) === 10) return true;
  // 172.16.0.0/12
  if ((num >>> 20) === (172 * 16 + 1)) return true; // 0xAC1 = 172.16
  if ((num >>> 16) >= 0xAC10 && (num >>> 16) <= 0xAC1F) return true;
  // 192.168.0.0/16
  if ((num >>> 16) === 0xC0A8) return true;
  // 169.254.0.0/16
  if ((num >>> 16) === 0xA9FE) return true;
  // 0.0.0.0
  if (num === 0) return true;
  return false;
}

/**
 * Sanitize settings data from a backup import to prevent stored XSS.
 * Strips HTML from text fields and sanitizes CSS.
 */
export function sanitizeBackupSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const textFields = [
    'serverName', 'appName', 'subtitleText', 'welcomeTitle', 'registerTitle',
    'footerText', 'buttonText', 'registerButtonText', 'onboardingTitle',
    'onboardingSubtitle', 'onboardingButtonText', 'preRegisterTitle',
    'preRegisterSubtitle', 'inviteRequestMessage',
  ];

  const sanitized = { ...settings };

  for (const field of textFields) {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = stripHtml(sanitized[field] as string);
    }
  }

  if (typeof sanitized.customCss === 'string') {
    sanitized.customCss = sanitizeCss(sanitized.customCss as string);
  }

  return sanitized;
}
