import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { jellyseerrFetch, getJellyseerrConfig } from '@/lib/servers/jellyseerr';
import { requestActionSchema, validateBody } from '@/lib/validation';

// GET /api/requests - List requests from Seerr
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const config = await getJellyseerrConfig();
    if (!config) {
      return NextResponse.json({ configured: false, requests: [], counts: null });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const take = searchParams.get('take') || '20';
    const skip = searchParams.get('skip') || '0';

    const filterParam = filter !== 'all' ? `&filter=${filter}` : '';
    const [requests, counts] = await Promise.all([
      jellyseerrFetch(`/request?take=${take}&skip=${skip}${filterParam}`),
      jellyseerrFetch('/request/count'),
    ]);

    // Enrich with poster URLs - try multiple paths where Jellyseerr stores poster info
    const enriched = await Promise.all(
      requests.results.map(async (req: Record<string, unknown>) => {
        const media = req.media as Record<string, unknown> | undefined;
        let posterPath = media?.posterPath as string | undefined;

        // If no posterPath on media, try fetching from Jellyseerr's media endpoint
        if (!posterPath && media?.tmdbId && media?.mediaType) {
          try {
            const mediaData = await jellyseerrFetch(
              `/${media.mediaType === 'movie' ? 'movie' : 'tv'}/${media.tmdbId}`
            );
            posterPath = mediaData?.posterPath;
          } catch {}
        }

        return {
          ...req,
          posterUrl: posterPath
            ? `https://image.tmdb.org/t/p/w185${posterPath}`
            : null,
        };
      })
    );

    return NextResponse.json({
      configured: true,
      requests: enriched,
      pageInfo: requests.pageInfo,
      counts,
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    return NextResponse.json(
      { message: 'Failed to fetch requests', configured: true },
      { status: 500 }
    );
  }
}

// POST /api/requests - Approve or decline a request
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(requestActionSchema, body);
    if (!parsed.success) return parsed.response;

    const { requestId, action } = parsed.data;

    const endpoint = action === 'approve'
      ? `/request/${requestId}/approve`
      : `/request/${requestId}/decline`;

    await jellyseerrFetch(endpoint, { method: 'POST' });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating request:', error);
    return NextResponse.json(
      { message: 'Failed to update request' },
      { status: 500 }
    );
  }
}
