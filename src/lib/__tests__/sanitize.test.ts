import { describe, it, expect } from 'vitest';
import { sanitizeCss, stripHtml, isPublicUrl, sanitizeBackupSettings } from '../sanitize';

describe('sanitizeCss', () => {
  it('passes through normal CSS', () => {
    const css = 'body { color: red; font-size: 14px; }';
    expect(sanitizeCss(css)).toBe(css);
  });

  it('removes @import rules', () => {
    const css = '@import url("https://evil.com/steal.css"); body { color: red; }';
    const result = sanitizeCss(css);
    expect(result).not.toContain('@import url');
    expect(result).toContain('removed');
    expect(result).toContain('body { color: red; }');
  });

  it('removes expression()', () => {
    const result = sanitizeCss('div { width: expression(document.body.clientWidth); }');
    expect(result).not.toContain('expression(');
  });

  it('removes -moz-binding', () => {
    const result = sanitizeCss('div { -moz-binding: url("xbl.xml"); }');
    expect(result).toContain('removed');
  });

  it('removes behavior:', () => {
    const result = sanitizeCss('div { behavior: url("htc.htc"); }');
    expect(result).toContain('removed');
  });

  it('blocks url() with javascript:', () => {
    const result = sanitizeCss('div { background: url(javascript:alert(1)); }');
    expect(result).toContain('blocked');
  });

  it('blocks url() with data:', () => {
    const result = sanitizeCss('div { background: url(data:text/html,<script>); }');
    expect(result).toContain('blocked');
  });

  it('blocks url() with external http', () => {
    const result = sanitizeCss('div { background: url(https://evil.com/track.gif); }');
    expect(result).toContain('blocked');
  });

  it('allows url() with relative paths', () => {
    const css = 'div { background: url(#noise-filter); }';
    expect(sanitizeCss(css)).toBe(css);
  });

  it('removes multiple @import rules', () => {
    const css = '@import "a.css"; @import "b.css"; body { color: red; }';
    const result = sanitizeCss(css);
    expect(result).not.toContain('@import "a');
    expect(result).not.toContain('@import "b');
  });

  it('handles case-insensitive keywords', () => {
    expect(sanitizeCss('div { width: EXPRESSION(1); }')).toContain('removed');
    expect(sanitizeCss('div { -MOZ-BINDING: url(x); }')).toContain('removed');
    expect(sanitizeCss('div { BEHAVIOR: url(x); }')).toContain('removed');
  });

  it('blocks url() with mixed-case javascript:', () => {
    const result = sanitizeCss('div { background: url(JavaScript:void(0)); }');
    expect(result).toContain('blocked');
  });
});

describe('stripHtml', () => {
  it('passes through plain text', () => {
    expect(stripHtml('Hello World')).toBe('Hello World');
  });

  it('removes script tags', () => {
    expect(stripHtml('Hello <script>alert(1)</script> World')).toBe('Hello  World');
  });

  it('removes iframe tags', () => {
    const result = stripHtml('Before <iframe src="evil.com"></iframe> After');
    expect(result).not.toContain('iframe');
  });

  it('removes event handlers', () => {
    const result = stripHtml('Hello <div onclick="alert(1)">');
    expect(result).not.toContain('onclick');
  });

  it('removes SVG and form tags', () => {
    const result = stripHtml('<svg onload="alert(1)"><rect/></svg><form action="evil.com">');
    expect(result).not.toContain('svg');
    expect(result).not.toContain('form');
  });
});

describe('isPublicUrl', () => {
  it('allows public URLs', () => {
    expect(isPublicUrl('https://example.com')).toBe(true);
    expect(isPublicUrl('https://api.discord.com/webhook')).toBe(true);
    expect(isPublicUrl('http://hooks.slack.com/test')).toBe(true);
  });

  it('blocks localhost', () => {
    expect(isPublicUrl('http://localhost/api')).toBe(false);
    expect(isPublicUrl('http://localhost:3000')).toBe(false);
  });

  it('blocks 127.x.x.x', () => {
    expect(isPublicUrl('http://127.0.0.1')).toBe(false);
    expect(isPublicUrl('http://127.0.0.1:8080')).toBe(false);
  });

  it('blocks 10.x.x.x private range', () => {
    expect(isPublicUrl('http://10.0.0.1')).toBe(false);
    expect(isPublicUrl('http://10.255.255.255')).toBe(false);
  });

  it('blocks 192.168.x.x private range', () => {
    expect(isPublicUrl('http://192.168.1.1')).toBe(false);
    expect(isPublicUrl('http://192.168.0.100')).toBe(false);
  });

  it('blocks 172.16-31.x.x private range', () => {
    expect(isPublicUrl('http://172.16.0.1')).toBe(false);
    expect(isPublicUrl('http://172.31.255.255')).toBe(false);
  });

  it('blocks 169.254.x.x link-local', () => {
    expect(isPublicUrl('http://169.254.169.254')).toBe(false);
  });

  it('blocks 0.0.0.0', () => {
    expect(isPublicUrl('http://0.0.0.0')).toBe(false);
  });

  it('blocks IPv6 loopback', () => {
    expect(isPublicUrl('http://[::1]')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isPublicUrl('not-a-url')).toBe(false);
    expect(isPublicUrl('')).toBe(false);
  });

  it('blocks private IPs with ports', () => {
    expect(isPublicUrl('http://192.168.1.1:8080')).toBe(false);
    expect(isPublicUrl('http://10.0.0.1:443')).toBe(false);
  });

  it('blocks URLs with credentials targeting private IPs', () => {
    expect(isPublicUrl('http://user:pass@127.0.0.1')).toBe(false);
  });

  it('allows public IPs with ports', () => {
    expect(isPublicUrl('https://93.184.216.34:443')).toBe(true);
  });

  it('blocks packed decimal IP for loopback', () => {
    // 2130706433 = 127.0.0.1
    expect(isPublicUrl('http://2130706433')).toBe(false);
  });

  it('blocks hex-encoded loopback', () => {
    // 0x7f000001 = 127.0.0.1
    expect(isPublicUrl('http://0x7f000001')).toBe(false);
  });
});

describe('sanitizeBackupSettings', () => {
  it('strips HTML from text fields', () => {
    const result = sanitizeBackupSettings({
      appName: 'My App <script>alert(1)</script>',
      welcomeTitle: 'Welcome <iframe src="evil">',
      smtpHost: 'smtp.example.com', // non-text field, should be untouched
    });
    expect(result.appName).not.toContain('script');
    expect(result.welcomeTitle).not.toContain('iframe');
    expect(result.smtpHost).toBe('smtp.example.com');
  });

  it('sanitizes customCss', () => {
    const result = sanitizeBackupSettings({
      customCss: '@import url("evil.css"); body { color: red; }',
    });
    expect(result.customCss).not.toContain('@import url');
  });

  it('passes through non-string fields', () => {
    const result = sanitizeBackupSettings({
      smtpPort: 587,
      enableAnimations: true,
    });
    expect(result.smtpPort).toBe(587);
    expect(result.enableAnimations).toBe(true);
  });
});
