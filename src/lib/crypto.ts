import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY is required in production. Generate one with: openssl rand -hex 32');
    }
    return null;
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    console.error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Encryption disabled.');
    return null;
  }
  return buf;
}

/**
 * Encrypt a plaintext string. Returns `enc:<iv>:<authTag>:<ciphertext>` in hex.
 * If ENCRYPTION_KEY is not set, returns plaintext unchanged (passthrough mode).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a string produced by encrypt(). If the string doesn't start with `enc:`,
 * it's treated as unencrypted plaintext (backwards compat).
 */
export function decrypt(stored: string): string {
  if (!stored.startsWith('enc:')) return stored;

  const key = getKey();
  if (!key) {
    console.error('Cannot decrypt: ENCRYPTION_KEY not set but encrypted data found.');
    return '';
  }

  const parts = stored.split(':');
  if (parts.length !== 4) return '';

  const iv = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');
  const ciphertext = Buffer.from(parts[3], 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

/**
 * Generate a cryptographically secure session token (64 hex chars = 256 bits).
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate a cryptographically secure invite code (10 hex chars = 40 bits).
 */
export function generateInviteCode(): string {
  return randomBytes(5).toString('hex').toUpperCase();
}

/**
 * Generate a random numeric PIN code of the given length (4-8 digits).
 */
export function generatePinCode(length: number = 6): string {
  const bytes = randomBytes(length);
  let pin = '';
  for (let i = 0; i < length; i++) {
    pin += (bytes[i] % 10).toString();
  }
  return pin;
}

/**
 * Decrypt server secrets in-place. Call this after reading a server from DB
 * before using token/apiKey/adminPassword.
 */
export function decryptServerSecrets<T extends { token?: string | null; apiKey?: string | null; adminPassword?: string | null }>(server: T): T {
  return {
    ...server,
    token: server.token ? decrypt(server.token) : server.token,
    apiKey: server.apiKey ? decrypt(server.apiKey) : server.apiKey,
    adminPassword: server.adminPassword ? decrypt(server.adminPassword) : server.adminPassword,
  };
}
