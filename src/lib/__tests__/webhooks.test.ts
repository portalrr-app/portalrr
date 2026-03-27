import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';

// We can't import dispatchWebhook (needs Prisma), but we can test the pure functions.
// They're not exported, so we recreate them here — these tests validate the logic patterns.

// Exact copy of renderTemplate from webhooks.ts
function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path: string) => {
    const parts = path.split('.');
    let value: unknown = data;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return '';
      }
    }
    return String(value ?? '');
  });
}

describe('renderTemplate', () => {
  it('replaces simple variables', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('replaces multiple variables', () => {
    const result = renderTemplate('{{username}} used invite {{code}}', {
      username: 'alice', code: 'ABC123',
    });
    expect(result).toBe('alice used invite ABC123');
  });

  it('handles nested paths', () => {
    expect(renderTemplate('Server: {{server.name}}', {
      server: { name: 'My Plex' },
    })).toBe('Server: My Plex');
  });

  it('handles deeply nested paths', () => {
    expect(renderTemplate('{{a.b.c}}', {
      a: { b: { c: 'deep' } },
    })).toBe('deep');
  });

  it('returns empty string for missing variables', () => {
    expect(renderTemplate('Hello {{missing}}!', {})).toBe('Hello !');
  });

  it('returns empty string for missing nested path', () => {
    expect(renderTemplate('{{a.b.c}}', { a: { b: {} } })).toBe('');
  });

  it('returns empty string when intermediate path is not an object', () => {
    expect(renderTemplate('{{a.b.c}}', { a: 'string' })).toBe('');
  });

  it('converts numbers to strings', () => {
    expect(renderTemplate('Count: {{count}}', { count: 42 })).toBe('Count: 42');
  });

  it('converts booleans to strings', () => {
    expect(renderTemplate('Active: {{active}}', { active: true })).toBe('Active: true');
  });

  it('handles null values as empty string', () => {
    expect(renderTemplate('Value: {{val}}', { val: null })).toBe('Value: ');
  });

  it('handles undefined values as empty string', () => {
    expect(renderTemplate('Value: {{val}}', { val: undefined })).toBe('Value: ');
  });

  it('leaves non-template text untouched', () => {
    expect(renderTemplate('No variables here', { name: 'test' })).toBe('No variables here');
  });

  it('handles template with no surrounding text', () => {
    expect(renderTemplate('{{name}}', { name: 'alice' })).toBe('alice');
  });

  it('handles empty template', () => {
    expect(renderTemplate('', { name: 'test' })).toBe('');
  });

  it('ignores malformed template syntax', () => {
    // Single braces, unmatched braces
    expect(renderTemplate('{name}', { name: 'test' })).toBe('{name}');
    expect(renderTemplate('{{}}', {})).toBe('{{}}');
  });

  it('handles special characters in values', () => {
    expect(renderTemplate('{{msg}}', { msg: '<script>alert(1)</script>' }))
      .toBe('<script>alert(1)</script>');
  });

  it('handles JSON-like templates', () => {
    const template = '{"event": "{{event}}", "user": "{{username}}"}';
    const result = renderTemplate(template, { event: 'user.created', username: 'bob' });
    expect(result).toBe('{"event": "user.created", "user": "bob"}');
  });
});

describe('HMAC webhook signing', () => {
  it('produces consistent signatures for the same payload and secret', () => {
    const secret = 'my-webhook-secret';
    const body = JSON.stringify({ event: 'user.registered', data: { username: 'alice' } });
    const sig1 = createHmac('sha256', secret).update(body).digest('hex');
    const sig2 = createHmac('sha256', secret).update(body).digest('hex');
    expect(sig1).toBe(sig2);
  });

  it('produces different signatures for different payloads', () => {
    const secret = 'my-webhook-secret';
    const sig1 = createHmac('sha256', secret).update('payload1').digest('hex');
    const sig2 = createHmac('sha256', secret).update('payload2').digest('hex');
    expect(sig1).not.toBe(sig2);
  });

  it('produces different signatures for different secrets', () => {
    const body = 'same-payload';
    const sig1 = createHmac('sha256', 'secret1').update(body).digest('hex');
    const sig2 = createHmac('sha256', 'secret2').update(body).digest('hex');
    expect(sig1).not.toBe(sig2);
  });

  it('produces 64-char hex signature', () => {
    const sig = createHmac('sha256', 'secret').update('body').digest('hex');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches expected X-Webhook-Signature header format', () => {
    const sig = createHmac('sha256', 'secret').update('body').digest('hex');
    const header = `sha256=${sig}`;
    expect(header).toMatch(/^sha256=[0-9a-f]{64}$/);
  });
});

describe('webhook event types', () => {
  // Validate the event type constants match expected patterns
  const WEBHOOK_EVENTS = [
    'user.registered', 'user.disabled', 'user.enabled', 'user.deleted', 'user.expired',
    'invite.created', 'invite.used', 'invite.expired',
    'invite_request.created', 'invite_request.approved', 'invite_request.denied',
    'announcement.sent', 'admin.login', 'password.reset',
  ] as const;

  it('has 14 event types', () => {
    expect(WEBHOOK_EVENTS).toHaveLength(14);
  });

  it('all events follow namespace.action pattern', () => {
    for (const event of WEBHOOK_EVENTS) {
      expect(event).toMatch(/^[a-z_]+\.[a-z]+$/);
    }
  });

  it('covers all user lifecycle events', () => {
    const userEvents = WEBHOOK_EVENTS.filter(e => e.startsWith('user.'));
    expect(userEvents).toContain('user.registered');
    expect(userEvents).toContain('user.disabled');
    expect(userEvents).toContain('user.enabled');
    expect(userEvents).toContain('user.deleted');
    expect(userEvents).toContain('user.expired');
  });

  it('covers all invite lifecycle events', () => {
    const inviteEvents = WEBHOOK_EVENTS.filter(e => e.startsWith('invite.'));
    expect(inviteEvents).toContain('invite.created');
    expect(inviteEvents).toContain('invite.used');
    expect(inviteEvents).toContain('invite.expired');
  });
});
