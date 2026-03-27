// @vitest-environment node
import { vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Create a mock NextRequest for testing API routes.
 */
export function createRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {}, cookies = {} } = options;

  const init: RequestInit & { headers: Record<string, string> } = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  // Build cookie header
  const cookieStr = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  if (cookieStr) {
    init.headers['cookie'] = cookieStr;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL(url, 'http://localhost'), init as any);
}

/**
 * Create a deep mock of the Prisma client with vi.fn() for all methods.
 */
export function createMockPrisma() {
  const mockModel = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  });

  return {
    admin: mockModel(),
    adminSession: mockModel(),
    user: mockModel(),
    userSession: mockModel(),
    invite: mockModel(),
    server: mockModel(),
    settings: mockModel(),
    webhook: mockModel(),
    auditLog: mockModel(),
    inviteRequest: mockModel(),
    userServer: mockModel(),
    emailTemplate: mockModel(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
}

/**
 * Parse JSON body from a Response.
 */
export async function jsonBody(response: Response) {
  return response.json();
}
