'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

interface MediaRequest {
  id: number;
  status: number;
  type: 'movie' | 'tv';
  createdAt: string;
  media: {
    tmdbId: number;
    status: number;
    mediaType: string;
    posterPath?: string;
  };
  requestedBy: {
    id: number;
    displayName: string;
    avatar?: string;
  };
  posterUrl?: string;
  title?: string;
  overview?: string;
  releaseDate?: string;
  voteAverage?: number;
  runtime?: number;
  seasons?: Array<{ seasonNumber: number }>;
}

interface RequestCounts {
  total: number;
  movie: number;
  tv: number;
  pending: number;
  approved: number;
  declined: number;
  processing: number;
  available: number;
}

type RequestFilter = 'pending' | 'processing' | 'available' | 'declined';

export default function RequestsPage() {
  const [requests, setRequests] = useState<MediaRequest[]>([]);
  const [requestCounts, setRequestCounts] = useState<RequestCounts | null>(null);
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('pending');
  const [jellyseerrConfigured, setJellyseerrConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URL(window.location.href).searchParams.get('q') || '';
    setSearch(q);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    let cancelled = false;
    const loadRequests = async () => {
      try {
        const res = await fetch(`/api/requests?take=60&filter=${requestFilter}`);
        const data = await res.json();
        if (cancelled) return;
        setJellyseerrConfigured(data.configured ?? false);
        setRequests(data.requests || []);
        setRequestCounts(data.counts || null);
      } catch {
        console.error('Failed to fetch requests');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadRequests();
    return () => { cancelled = true; };
  }, [requestFilter]);

  const handleRequestAction = async (requestId: number, action: 'approve' | 'decline') => {
    setActionLoading(requestId);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      if (res.ok) {
        const refreshRes = await fetch(`/api/requests?take=60&filter=${requestFilter}`);
        const data = await refreshRes.json();
        setJellyseerrConfigured(data.configured ?? false);
        setRequests(data.requests || []);
        setRequestCounts(data.counts || null);
      }
    } catch {
      console.error('Failed to update request');
    }
    setActionLoading(null);
  };

  const tabs: { value: RequestFilter; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'available', label: 'Available' },
    { value: 'declined', label: 'Declined' },
  ];

  const tabCount = (f: RequestFilter): number => {
    if (!requestCounts) return 0;
    return requestCounts[f] || 0;
  };

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>
            Requests
            {requestCounts && requestCounts.pending > 0 && (
              <span style={{ color: 'var(--accent)', fontSize: 18, fontWeight: 500, fontFamily: 'var(--font-body)', marginLeft: 10 }}>
                {requestCounts.pending} pending
              </span>
            )}
          </h1>
          <div className="adm-sub">
            Content your users want. Approved items flow to your *arr stack automatically.
          </div>
        </div>
      </div>

      {!jellyseerrConfigured && !loading ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Jellyseerr / Overseerr not configured</p>
          <p>Add your Seerr URL and API key in Settings to manage requests.</p>
        </div>
      ) : (
        <>
          {requestCounts && (
            <div className={styles.statsRow}>
              <Stat label="Pending" value={requestCounts.pending} sub="awaiting review" />
              <Stat label="Approved" value={requestCounts.approved} sub="this session" tone="success" />
              <Stat label="Processing" value={requestCounts.processing} sub="in *arr queue" />
              <Stat label="Available" value={requestCounts.available} sub="ready to stream" tone="success" />
            </div>
          )}

          <div className={styles.segTabs}>
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`${styles.segBtn} ${requestFilter === t.value ? styles.segBtnOn : ''}`}
                onClick={() => setRequestFilter(t.value)}
              >
                {t.label}
                <span className={styles.segCount}>{tabCount(t.value)}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className={styles.emptyState}><p>Loading…</p></div>
          ) : (() => {
            const filtered = search
              ? requests.filter((r) => {
                  const q = search.toLowerCase();
                  return (
                    (r.title || '').toLowerCase().includes(q) ||
                    (r.requestedBy.displayName || '').toLowerCase().includes(q) ||
                    r.type.includes(q)
                  );
                })
              : requests;
            if (filtered.length === 0) {
              return (
                <div className={styles.emptyState}>
                  <p className={styles.emptyTitle}>
                    {requests.length === 0 ? `No ${requestFilter} requests` : 'No matches'}
                  </p>
                  <p>
                    {requests.length === 0
                      ? 'Check back when your users submit new requests.'
                      : `Nothing matched "${search}".`}
                  </p>
                </div>
              );
            }
            return (
              <div className={styles.grid}>
                {filtered.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    onApprove={() => handleRequestAction(req.id, 'approve')}
                    onDecline={() => handleRequestAction(req.id, 'decline')}
                    busy={actionLoading === req.id}
                  />
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: 'success' }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLbl}>{label}</div>
      <div className={styles.statVal}>{value}</div>
      <div
        className={styles.statSub}
        style={tone === 'success' ? { color: 'var(--success)' } : undefined}
      >
        {sub}
      </div>
    </div>
  );
}

function RequestCard({
  req,
  onApprove,
  onDecline,
  busy,
}: {
  req: MediaRequest;
  onApprove: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const title = req.title || `#${req.media.tmdbId}`;
  const isMovie = req.type === 'movie';
  const year = req.releaseDate ? new Date(req.releaseDate).getFullYear() : null;
  const ago = formatRelative(req.createdAt);
  const subtitle = buildSubtitle(req, year);
  const initial = title.charAt(0).toUpperCase();
  const rating = req.voteAverage ? `★ ${req.voteAverage.toFixed(1)}` : null;
  const posterBg = req.posterUrl
    ? `url(${req.posterUrl}) center/cover`
    : `linear-gradient(135deg, ${posterColor(title)}, #1a0d2e)`;

  const avatarColors = avatarGradient(req.requestedBy.displayName);
  const avatarInitials = (req.requestedBy.displayName || '?').slice(0, 2).toUpperCase();

  return (
    <article className={styles.rcard}>
      <div className={styles.poster} style={{ background: posterBg }}>
        {!req.posterUrl && <div className={styles.posterBg}>{initial}</div>}
        <div className={styles.posterScrim} />
        <span className={`${styles.typeBadge} ${isMovie ? styles.typeMovie : styles.typeShow}`}>
          {isMovie ? 'Movie' : 'TV'}
        </span>
        {rating && <span className={styles.rating}>{rating}</span>}
        <div className={styles.posterMeta}>
          <h3>{title}</h3>
          <div className={styles.posterSub}>{subtitle}</div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.by}>
          {req.requestedBy.avatar ? (
            <img src={req.requestedBy.avatar} alt="" className={styles.byAvImg} />
          ) : (
            <div
              className={styles.byAv}
              style={{ background: `linear-gradient(135deg, ${avatarColors[0]}, ${avatarColors[1]})` }}
            >
              {avatarInitials}
            </div>
          )}
          <b className={styles.byName}>{req.requestedBy.displayName}</b>
          <em className={styles.byAgo}>{ago}</em>
        </div>

        {req.overview && (
          <div className={styles.note}>&ldquo;{req.overview.slice(0, 140)}{req.overview.length > 140 ? '…' : ''}&rdquo;</div>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`adm-btn adm-btn-sm ${styles.declineBtn}`}
          onClick={onDecline}
          disabled={busy || req.status !== 1}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Decline
        </button>
        <button
          type="button"
          className="adm-btn adm-btn-primary adm-btn-sm"
          onClick={onApprove}
          disabled={busy || req.status !== 1}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {req.status === 1 ? 'Approve' : statusLabel(req.status)}
        </button>
      </div>
    </article>
  );
}

function buildSubtitle(req: MediaRequest, year: number | null): string {
  const bits: string[] = [];
  if (year) bits.push(String(year));
  bits.push(req.type === 'movie' ? 'Movie' : 'TV');
  if (req.runtime && req.type === 'movie') bits.push(`${req.runtime}m`);
  if (req.seasons && req.seasons.length > 0) {
    bits.push(`${req.seasons.length} season${req.seasons.length === 1 ? '' : 's'}`);
  }
  return bits.join(' · ');
}

function statusLabel(status: number): string {
  if (status === 2) return 'Approved';
  if (status === 3) return 'Declined';
  return 'Pending';
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function posterColor(title: string): string {
  const hues = ['#c89968', '#1a3a5c', '#2a2a4e', '#5c1a1a', '#d4a05c', '#8b5a1a', '#3a1a1a'];
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) | 0;
  return hues[Math.abs(h) % hues.length];
}

function avatarGradient(name: string): [string, string] {
  const pairs: [string, string][] = [
    ['#FFC66E', '#FF7B6E'],
    ['#A78BFA', '#7C5CFF'],
    ['#60A5FA', '#3B82F6'],
    ['#34D399', '#059669'],
    ['#F87171', '#DC2626'],
    ['#FB923C', '#EA580C'],
    ['#FACC15', '#CA8A04'],
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return pairs[Math.abs(h) % pairs.length];
}
