import { describe, it, expect } from 'vitest';
import {
  loginSchema, setupSchema, registerSchema, createInviteSchema,
  createServerSchema, updateSettingsSchema, createAdminSchema,
  changePasswordSchema, createInviteRequestSchema, bulkUsersSchema,
  createWebhookSchema, importUsersSchema, validateBody,
} from '../validation';

describe('loginSchema', () => {
  it('accepts valid login', () => {
    expect(loginSchema.safeParse({ username: 'admin', password: 'password123' }).success).toBe(true);
  });

  it('accepts login with TOTP', () => {
    expect(loginSchema.safeParse({ username: 'admin', password: 'pass', totpCode: '123456' }).success).toBe(true);
  });

  it('rejects empty username', () => {
    expect(loginSchema.safeParse({ username: '', password: 'pass' }).success).toBe(false);
  });

  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ username: 'admin', password: '' }).success).toBe(false);
  });

  it('rejects TOTP code that is not 6 chars', () => {
    expect(loginSchema.safeParse({ username: 'admin', password: 'pass', totpCode: '12345' }).success).toBe(false);
    expect(loginSchema.safeParse({ username: 'admin', password: 'pass', totpCode: '1234567' }).success).toBe(false);
  });
});

describe('setupSchema', () => {
  it('accepts valid setup', () => {
    expect(setupSchema.safeParse({ username: 'admin', password: 'longpassword' }).success).toBe(true);
  });

  it('rejects short username', () => {
    expect(setupSchema.safeParse({ username: 'ab', password: 'longpassword' }).success).toBe(false);
  });

  it('rejects short password', () => {
    expect(setupSchema.safeParse({ username: 'admin', password: 'short' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  const valid = { code: 'ABC123', email: 'user@example.com', username: 'testuser', password: 'pass1234' };

  it('accepts valid registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts with optional passphrase', () => {
    expect(registerSchema.safeParse({ ...valid, passphrase: 'secret' }).success).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'not-email' }).success).toBe(false);
  });

  it('rejects short username', () => {
    expect(registerSchema.safeParse({ ...valid, username: 'ab' }).success).toBe(false);
  });

  it('rejects username with spaces', () => {
    expect(registerSchema.safeParse({ ...valid, username: 'user name' }).success).toBe(false);
  });

  it('rejects username with special chars', () => {
    expect(registerSchema.safeParse({ ...valid, username: 'user@name' }).success).toBe(false);
  });

  it('accepts username with dashes and underscores', () => {
    expect(registerSchema.safeParse({ ...valid, username: 'my-user_name' }).success).toBe(true);
  });

  it('rejects username over 20 chars', () => {
    expect(registerSchema.safeParse({ ...valid, username: 'a'.repeat(21) }).success).toBe(false);
  });
});

describe('createInviteSchema', () => {
  it('accepts minimal invite', () => {
    const result = createInviteSchema.safeParse({ serverId: 'server-1' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxUses).toBe(1);
      expect(result.data.expiresInDays).toBe(7);
      expect(result.data.codeType).toBe('random');
    }
  });

  it('accepts full invite config', () => {
    expect(createInviteSchema.safeParse({
      serverId: 'server-1',
      maxUses: 5,
      expiresInDays: 30,
      accessDurationDays: 90,
      autoRemove: true,
      libraries: ['lib1', 'lib2'],
      codeType: 'pin',
      pinLength: 8,
      label: 'friends',
      passphrase: 'secret',
      notifyOnUse: true,
      notifyOnExpiry: true,
    }).success).toBe(true);
  });

  it('accepts custom code type', () => {
    expect(createInviteSchema.safeParse({
      serverId: 'server-1',
      codeType: 'custom',
      customCode: 'MY-CODE-123',
    }).success).toBe(true);
  });

  it('rejects custom code with invalid chars', () => {
    expect(createInviteSchema.safeParse({
      serverId: 'server-1',
      codeType: 'custom',
      customCode: 'has spaces!',
    }).success).toBe(false);
  });

  it('rejects negative maxUses', () => {
    expect(createInviteSchema.safeParse({ serverId: 's', maxUses: -1 }).success).toBe(false);
  });

  it('rejects expiresInDays over 365', () => {
    expect(createInviteSchema.safeParse({ serverId: 's', expiresInDays: 366 }).success).toBe(false);
  });

  it('rejects pinLength outside 4-8 range', () => {
    expect(createInviteSchema.safeParse({ serverId: 's', pinLength: 3 }).success).toBe(false);
    expect(createInviteSchema.safeParse({ serverId: 's', pinLength: 9 }).success).toBe(false);
  });

  it('rejects missing serverId', () => {
    expect(createInviteSchema.safeParse({}).success).toBe(false);
  });
});

describe('createServerSchema', () => {
  it('accepts valid server', () => {
    expect(createServerSchema.safeParse({
      name: 'My Plex', type: 'plex', url: 'https://plex.example.com',
    }).success).toBe(true);
  });

  it('accepts jellyfin with credentials', () => {
    expect(createServerSchema.safeParse({
      name: 'Jellyfin', type: 'jellyfin', url: 'https://jf.example.com',
      apiKey: 'abc123', adminUsername: 'admin', adminPassword: 'pass',
    }).success).toBe(true);
  });

  it('rejects invalid URL', () => {
    expect(createServerSchema.safeParse({
      name: 'Bad', type: 'plex', url: 'not-a-url',
    }).success).toBe(false);
  });

  it('rejects invalid server type', () => {
    expect(createServerSchema.safeParse({
      name: 'Bad', type: 'emby', url: 'https://example.com',
    }).success).toBe(false);
  });
});

describe('updateSettingsSchema', () => {
  it('accepts empty update (all optional)', () => {
    expect(updateSettingsSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid accent color', () => {
    expect(updateSettingsSchema.safeParse({ accentColor: '#A78BFA' }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ accentColor: '#fff' }).success).toBe(true);
  });

  it('rejects invalid accent color', () => {
    expect(updateSettingsSchema.safeParse({ accentColor: 'red' }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ accentColor: '#gggggg' }).success).toBe(false);
  });

  it('accepts valid enums', () => {
    expect(updateSettingsSchema.safeParse({
      backgroundStyle: 'gradient', cardStyle: 'glass', buttonStyle: 'pill',
      inputStyle: 'underline', borderRadius: 'large', gradientDirection: 'radial',
      logoMode: 'icon', expiryPolicy: 'disable_then_delete',
    }).success).toBe(true);
  });

  it('rejects invalid enum values', () => {
    expect(updateSettingsSchema.safeParse({ backgroundStyle: 'striped' }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ cardStyle: 'neon' }).success).toBe(false);
  });

  it('validates SMTP port range', () => {
    expect(updateSettingsSchema.safeParse({ smtpPort: 587 }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ smtpPort: 0 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ smtpPort: 70000 }).success).toBe(false);
  });

  it('validates password rules', () => {
    expect(updateSettingsSchema.safeParse({ passwordMinLength: 8 }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ passwordMinLength: 3 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ passwordMinLength: 200 }).success).toBe(false);
  });
});

describe('createAdminSchema', () => {
  it('accepts valid admin', () => {
    expect(createAdminSchema.safeParse({ username: 'admin_user', password: 'securepass' }).success).toBe(true);
  });

  it('rejects username with special chars', () => {
    expect(createAdminSchema.safeParse({ username: 'admin@user', password: 'securepass' }).success).toBe(false);
    expect(createAdminSchema.safeParse({ username: 'admin user', password: 'securepass' }).success).toBe(false);
  });

  it('rejects short password', () => {
    expect(createAdminSchema.safeParse({ username: 'admin', password: 'short' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts valid password change', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'newpassword' }).success).toBe(true);
  });

  it('rejects short new password', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'short' }).success).toBe(false);
  });
});

describe('createInviteRequestSchema', () => {
  it('accepts valid request', () => {
    expect(createInviteRequestSchema.safeParse({
      email: 'user@example.com', username: 'user123',
    }).success).toBe(true);
  });

  it('accepts request with message', () => {
    expect(createInviteRequestSchema.safeParse({
      email: 'user@example.com', username: 'user123', message: 'Please add me!',
    }).success).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(createInviteRequestSchema.safeParse({
      email: 'bademail', username: 'user123',
    }).success).toBe(false);
  });
});

describe('bulkUsersSchema', () => {
  it('accepts valid bulk action', () => {
    expect(bulkUsersSchema.safeParse({
      userIds: ['u1', 'u2'], action: 'delete',
    }).success).toBe(true);
  });

  it('accepts apply_profile action with profile', () => {
    expect(bulkUsersSchema.safeParse({
      userIds: ['u1'],
      action: 'apply_profile',
      profile: { libraries: ['lib1'], accessDurationDays: 30 },
    }).success).toBe(true);
  });

  it('rejects empty userIds', () => {
    expect(bulkUsersSchema.safeParse({ userIds: [], action: 'delete' }).success).toBe(false);
  });

  it('rejects invalid action', () => {
    expect(bulkUsersSchema.safeParse({ userIds: ['u1'], action: 'nuke' }).success).toBe(false);
  });
});

describe('createWebhookSchema', () => {
  it('accepts valid webhook', () => {
    expect(createWebhookSchema.safeParse({
      name: 'My Hook', url: 'https://hooks.example.com/endpoint',
    }).success).toBe(true);
  });

  it('rejects private IP webhook URL', () => {
    expect(createWebhookSchema.safeParse({
      name: 'Bad', url: 'http://192.168.1.1/hook',
    }).success).toBe(false);
  });

  it('rejects localhost webhook URL', () => {
    expect(createWebhookSchema.safeParse({
      name: 'Bad', url: 'http://localhost/hook',
    }).success).toBe(false);
  });
});

describe('importUsersSchema', () => {
  it('accepts valid import', () => {
    expect(importUsersSchema.safeParse({
      serverId: 's1', userIds: ['u1', 'u2'],
    }).success).toBe(true);
  });

  it('rejects empty userIds', () => {
    expect(importUsersSchema.safeParse({
      serverId: 's1', userIds: [],
    }).success).toBe(false);
  });
});

describe('validateBody helper', () => {
  it('returns success with parsed data for valid input', () => {
    const result = validateBody(loginSchema, { username: 'admin', password: 'pass123' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe('admin');
    }
  });

  it('returns failure with 400 response for invalid input', () => {
    const result = validateBody(loginSchema, { username: '', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
    }
  });

  it('includes field-level errors in response body', async () => {
    const result = validateBody(registerSchema, { code: '', email: 'bad', username: 'x', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const body = await result.response.json();
      expect(body.message).toBe('Validation failed');
      expect(body.errors).toBeInstanceOf(Array);
      expect(body.errors.length).toBeGreaterThan(0);
      expect(body.errors[0]).toHaveProperty('field');
      expect(body.errors[0]).toHaveProperty('message');
    }
  });
});

describe('boundary values', () => {
  it('loginSchema accepts max length username (50 chars)', () => {
    expect(loginSchema.safeParse({ username: 'a'.repeat(50), password: 'pass' }).success).toBe(true);
  });

  it('loginSchema rejects username over 50 chars', () => {
    expect(loginSchema.safeParse({ username: 'a'.repeat(51), password: 'pass' }).success).toBe(false);
  });

  it('loginSchema accepts max length password (128 chars)', () => {
    expect(loginSchema.safeParse({ username: 'admin', password: 'a'.repeat(128) }).success).toBe(true);
  });

  it('loginSchema rejects password over 128 chars', () => {
    expect(loginSchema.safeParse({ username: 'admin', password: 'a'.repeat(129) }).success).toBe(false);
  });

  it('registerSchema trims whitespace from username', () => {
    const result = registerSchema.safeParse({
      code: 'ABC', email: 'user@example.com', username: '  user  ', password: 'pass',
    });
    // Username has regex validation, spaces should fail
    expect(result.success).toBe(false);
  });

  it('registerSchema accepts exactly 20-char username', () => {
    expect(registerSchema.safeParse({
      code: 'ABC', email: 'a@b.com', username: 'a'.repeat(20), password: 'pass',
    }).success).toBe(true);
  });

  it('createInviteSchema accepts exactly 0 maxUses (unlimited)', () => {
    const result = createInviteSchema.safeParse({ serverId: 's', maxUses: 0 });
    expect(result.success).toBe(true);
  });

  it('createInviteSchema accepts max 10000 maxUses', () => {
    expect(createInviteSchema.safeParse({ serverId: 's', maxUses: 10000 }).success).toBe(true);
    expect(createInviteSchema.safeParse({ serverId: 's', maxUses: 10001 }).success).toBe(false);
  });

  it('createInviteSchema accepts max 365 expiresInDays', () => {
    expect(createInviteSchema.safeParse({ serverId: 's', expiresInDays: 365 }).success).toBe(true);
  });

  it('createInviteSchema accepts max 36500 accessDurationDays (~100 years)', () => {
    expect(createInviteSchema.safeParse({ serverId: 's', accessDurationDays: 36500 }).success).toBe(true);
    expect(createInviteSchema.safeParse({ serverId: 's', accessDurationDays: 36501 }).success).toBe(false);
  });
});

describe('nullable fields in updateSettingsSchema', () => {
  it('accepts null for nullable string fields', () => {
    expect(updateSettingsSchema.safeParse({
      smtpHost: null, smtpPass: null, customCss: null,
      logoUrl: null, footerText: null, backgroundImageUrl: null,
      jellyseerrUrl: null, jellyseerrApiKey: null,
    }).success).toBe(true);
  });

  it('accepts null for nullable number fields', () => {
    expect(updateSettingsSchema.safeParse({ smtpPort: null }).success).toBe(true);
  });

  it('rejects non-null invalid values for nullable fields', () => {
    expect(updateSettingsSchema.safeParse({ smtpPort: -1 }).success).toBe(false);
  });
});

describe('accent color validation edge cases', () => {
  it('accepts 3-char hex', () => {
    expect(updateSettingsSchema.safeParse({ accentColor: '#abc' }).success).toBe(true);
  });

  it('accepts 6-char hex', () => {
    expect(updateSettingsSchema.safeParse({ accentColor: '#aabbcc' }).success).toBe(true);
  });

  it('accepts 8-char hex (with alpha)', () => {
    expect(updateSettingsSchema.safeParse({ accentColor: '#aabbccdd' }).success).toBe(true);
  });

  it('rejects 2-char hex', () => {
    expect(updateSettingsSchema.safeParse({ accentColor: '#ab' }).success).toBe(false);
  });

  it('rejects hex without #', () => {
    expect(updateSettingsSchema.safeParse({ accentColor: 'aabbcc' }).success).toBe(false);
  });

  it('rejects color names', () => {
    expect(updateSettingsSchema.safeParse({ accentColor: 'red' }).success).toBe(false);
  });

  it('rejects rgb()', () => {
    expect(updateSettingsSchema.safeParse({ accentColor: 'rgb(255,0,0)' }).success).toBe(false);
  });
});
