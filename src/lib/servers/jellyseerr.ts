import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

interface JellyseerrConfig {
  url: string;
  apiKey: string;
}

export async function getJellyseerrConfig(): Promise<JellyseerrConfig | null> {
  const settings = await prisma.settings.findUnique({ where: { id: 'main' } });
  if (!settings?.jellyseerrUrl || !settings?.jellyseerrApiKey) return null;
  return { url: settings.jellyseerrUrl.replace(/\/$/, ''), apiKey: decrypt(settings.jellyseerrApiKey) };
}

export async function jellyseerrFetch(path: string, options: RequestInit = {}) {
  const config = await getJellyseerrConfig();
  if (!config) throw new Error('Seerr not configured');

  const res = await fetch(`${config.url}/api/v1${path}`, {
    ...options,
    headers: {
      'X-Api-Key': config.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Seerr API error ${res.status}: ${text}`);
  }

  return res.json();
}

export interface JellyseerrRequest {
  id: number;
  status: number; // 1=PENDING, 2=APPROVED, 3=DECLINED
  type: 'movie' | 'tv';
  createdAt: string;
  updatedAt: string;
  media: {
    tmdbId: number;
    status: number;
    mediaType: string;
    posterPath?: string;
  };
  requestedBy: {
    id: number;
    displayName: string;
    email?: string;
    avatar?: string;
  };
  seasons?: Array<{ seasonNumber: number }>;
}

export interface JellyseerrRequestsResponse {
  pageInfo: { pages: number; pageSize: number; results: number; page: number };
  results: JellyseerrRequest[];
}

export interface JellyseerrRequestCount {
  total: number;
  movie: number;
  tv: number;
  pending: number;
  approved: number;
  declined: number;
  processing: number;
  available: number;
}
