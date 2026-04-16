import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, generateSessionToken, generateInviteCode, generatePinCode, decryptServerSecrets } from '../crypto';

// A valid 32-byte (64 hex char) key for testing
const TEST_KEY = 'a'.repeat(64);

describe('crypto', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('encrypt/decrypt roundtrip', () => {
    it('encrypts and decrypts back to original plaintext', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const plaintext = 'my-secret-token-123';
      const encrypted = encrypt(plaintext);
      expect(encrypted).toMatch(/^enc:/);
      expect(encrypted).not.toContain(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it('handles empty string', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const encrypted = encrypt('');
      expect(decrypt(encrypted)).toBe('');
    });

    it('handles unicode content', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const plaintext = 'héllo wörld 日本語 🎉';
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it('handles long strings', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const plaintext = 'x'.repeat(10000);
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it('produces different ciphertexts for the same input (random IV)', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const a = encrypt('same-input');
      const b = encrypt('same-input');
      expect(a).not.toBe(b);
      // Both should still decrypt to the same thing
      expect(decrypt(a)).toBe('same-input');
      expect(decrypt(b)).toBe('same-input');
    });
  });

  describe('passthrough mode (no key)', () => {
    it('returns plaintext when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;
      (process.env as Record<string, string>).NODE_ENV = 'development';
      const plaintext = 'my-secret';
      expect(encrypt(plaintext)).toBe(plaintext);
    });

    it('returns unencrypted strings as-is from decrypt', () => {
      delete process.env.ENCRYPTION_KEY;
      (process.env as Record<string, string>).NODE_ENV = 'development';
      expect(decrypt('not-encrypted')).toBe('not-encrypted');
    });
  });

  describe('decrypt edge cases', () => {
    it('returns plaintext for strings not starting with enc:', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      expect(decrypt('plain-token')).toBe('plain-token');
    });

    it('returns empty string for malformed encrypted strings', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      expect(decrypt('enc:bad')).toBe('');
      expect(decrypt('enc:a:b')).toBe('');
    });

    it('throws/returns empty for tampered ciphertext', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const encrypted = encrypt('secret');
      // Tamper with the ciphertext
      const parts = encrypted.split(':');
      parts[3] = 'ff'.repeat(parts[3].length / 2);
      const tampered = parts.join(':');
      expect(() => decrypt(tampered)).toThrow();
    });

    it('throws/returns empty for wrong key', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const encrypted = encrypt('secret');

      // Switch to different key
      process.env.ENCRYPTION_KEY = 'b'.repeat(64);
      expect(() => decrypt(encrypted)).toThrow();
    });
  });

  describe('invalid key', () => {
    it('returns plaintext when key is wrong length', () => {
      process.env.ENCRYPTION_KEY = 'tooshort';
      (process.env as Record<string, string>).NODE_ENV = 'development';
      expect(encrypt('test')).toBe('test');
    });

    it('throws in production without key', () => {
      delete process.env.ENCRYPTION_KEY;
      (process.env as Record<string, string>).NODE_ENV = 'production';
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY is required in production');
    });
  });

  describe('generateSessionToken', () => {
    it('returns a 64-char hex string', () => {
      const token = generateSessionToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates unique tokens', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateSessionToken()));
      expect(tokens.size).toBe(100);
    });
  });

  describe('generateInviteCode', () => {
    it('returns a 32-char uppercase hex string (128 bits)', () => {
      const code = generateInviteCode();
      expect(code).toMatch(/^[0-9A-F]{32}$/);
    });

    it('generates unique codes', () => {
      const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()));
      expect(codes.size).toBe(100);
    });
  });

  describe('generatePinCode', () => {
    it('generates a pin of default length 6', () => {
      const pin = generatePinCode();
      expect(pin).toMatch(/^\d{6}$/);
    });

    it('generates a pin of specified length', () => {
      expect(generatePinCode(4)).toMatch(/^\d{4}$/);
      expect(generatePinCode(8)).toMatch(/^\d{8}$/);
    });

    it('only contains digits 0-9', () => {
      // Generate many to increase confidence
      for (let i = 0; i < 50; i++) {
        expect(generatePinCode(8)).toMatch(/^\d{8}$/);
      }
    });
  });

  describe('decryptServerSecrets', () => {
    it('decrypts all secret fields in a server object', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const server = {
        id: '1',
        name: 'Test Server',
        token: encrypt('plex-token-123'),
        apiKey: encrypt('api-key-456'),
        adminPassword: encrypt('admin-pass-789'),
      };
      const decrypted = decryptServerSecrets(server);
      expect(decrypted.token).toBe('plex-token-123');
      expect(decrypted.apiKey).toBe('api-key-456');
      expect(decrypted.adminPassword).toBe('admin-pass-789');
      expect(decrypted.id).toBe('1');
      expect(decrypted.name).toBe('Test Server');
    });

    it('handles null/undefined secret fields', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const server = { token: null, apiKey: undefined, adminPassword: null };
      const decrypted = decryptServerSecrets(server);
      expect(decrypted.token).toBeNull();
      expect(decrypted.apiKey).toBeUndefined();
      expect(decrypted.adminPassword).toBeNull();
    });

    it('handles unencrypted (legacy) values', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const server = { token: 'plain-token', apiKey: null, adminPassword: null };
      const decrypted = decryptServerSecrets(server);
      expect(decrypted.token).toBe('plain-token');
    });
  });

  describe('encrypt output format', () => {
    it('produces enc:<iv>:<authTag>:<ciphertext> format', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const encrypted = encrypt('test');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('enc');
      expect(parts[1]).toMatch(/^[0-9a-f]{24}$/); // 12 bytes IV = 24 hex
      expect(parts[2]).toMatch(/^[0-9a-f]{32}$/); // 16 bytes auth tag = 32 hex
      expect(parts[3]).toMatch(/^[0-9a-f]+$/);    // ciphertext is hex
    });
  });

  describe('decrypt with malformed hex', () => {
    it('fails on invalid hex in IV', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      // Buffer.from with invalid hex doesn't throw, but decryption will fail
      // Either throws or returns empty/garbage — just verify it doesn't return meaningful data
      try {
        const result = decrypt('enc:zzzzzzzzzzzzzzzzzzzzzzzz:' + 'aa'.repeat(16) + ':aabb');
        expect(result).not.toBe('aabb');
      } catch {
        // Throwing is also acceptable behavior
      }
    });

    it('throws on tampered auth tag', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const encrypted = encrypt('secret');
      const parts = encrypted.split(':');
      parts[2] = '00'.repeat(16); // zero out the auth tag
      expect(() => decrypt(parts.join(':'))).toThrow();
    });
  });

  describe('generatePinCode edge lengths', () => {
    it('generates pin of length 5', () => {
      expect(generatePinCode(5)).toMatch(/^\d{5}$/);
    });

    it('generates pin of length 7', () => {
      expect(generatePinCode(7)).toMatch(/^\d{7}$/);
    });
  });

  describe('key boundary cases', () => {
    it('works with exactly 64 hex char key', () => {
      process.env.ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
      const encrypted = encrypt('boundary-test');
      expect(decrypt(encrypted)).toBe('boundary-test');
    });

    it('rejects 62 hex char key (too short)', () => {
      process.env.ENCRYPTION_KEY = 'a'.repeat(62);
      (process.env as Record<string, string>).NODE_ENV = 'development';
      expect(encrypt('test')).toBe('test'); // passthrough
    });

    it('rejects 66 hex char key (too long)', () => {
      process.env.ENCRYPTION_KEY = 'a'.repeat(66);
      (process.env as Record<string, string>).NODE_ENV = 'development';
      expect(encrypt('test')).toBe('test'); // passthrough
    });
  });
});
