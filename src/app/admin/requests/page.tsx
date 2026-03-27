'use client';

import { useEffect, useState } from 'react';
import { Button, StatusBadge } from '@/components';
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

type RequestFilter = 'all' | 'pending' | 'approved' | 'processing' | 'available';

const STATUS_MAP: Record<number, string> = {
  1: 'Pending',
  2: 'Approved',
  3: 'Declined',
};

const STATUS_BADGE: Record<number, 'pending' | 'active' | 'expired'> = {
  1: 'pending',
  2: 'active',
  3: 'expired',
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<MediaRequest[]>([]);
  const [requestCounts, setRequestCounts] = useState<RequestCounts | null>(null);
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('all');
  const [jellyseerrConfigured, setJellyseerrConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRequests = async () => {
      try {
        const filterParam = requestFilter !== 'all' ? `&filter=${requestFilter}` : '';
        const res = await fetch(`/api/requests?take=50${filterParam}`);
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

    return () => {
      cancelled = true;
    };
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
        const filterParam = requestFilter !== 'all' ? `&filter=${requestFilter}` : '';
        const refreshRes = await fetch(`/api/requests?take=50${filterParam}`);
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const filters: { value: RequestFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'processing', label: 'Processing' },
    { value: 'available', label: 'Available' },
  ];

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Requests</h1>
          <p className={styles.subtitle}>Manage media requests from Seerr</p>
        </div>
      </div>

      {loading ? (
        <div className={styles.emptyState}>
          <p>Loading...</p>
        </div>
      ) : !jellyseerrConfigured ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>Seerr not configured</p>
          <p className={styles.emptyStateText}>
            Add your Seerr URL and API key in Settings to manage requests
          </p>
        </div>
      ) : (
        <>
          {requestCounts && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{requestCounts.total}</span>
                <span className={styles.statLabel}>Total</span>
              </div>
              <div className={styles.statCard}>
                <span className={`${styles.statValue} ${styles.pendingText}`}>{requestCounts.pending}</span>
                <span className={styles.statLabel}>Pending</span>
              </div>
              <div className={styles.statCard}>
                <span className={`${styles.statValue} ${styles.approvedText}`}>{requestCounts.approved}</span>
                <span className={styles.statLabel}>Approved</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{requestCounts.available}</span>
                <span className={styles.statLabel}>Available</span>
              </div>
            </div>
          )}

          <div className={styles.filters}>
            {filters.map((f) => (
              <button
                key={f.value}
                className={`${styles.filterButton} ${requestFilter === f.value ? styles.active : ''}`}
                onClick={() => setRequestFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <div>Media</div>
              <div>Requested By</div>
              <div>Type</div>
              <div>Date</div>
              <div>Status</div>
              <div>Actions</div>
            </div>

            {requests.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateTitle}>No {requestFilter !== 'all' ? requestFilter : ''} requests</p>
                <p className={styles.emptyStateText}>Requests will appear here when users submit them</p>
              </div>
            ) : (
              requests.map((req) => (
                <div key={req.id} className={styles.tableRow}>
                  <div data-label="Media" className={styles.mediaCell}>
                    {req.posterUrl ? (
                      <img className={styles.poster} src={req.posterUrl} alt="" />
                    ) : (
                      <div className={styles.noPoster}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="2" width="20" height="20" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div data-label="Requested By" className={styles.requestUser}>
                    {req.requestedBy.displayName}
                  </div>
                  <div data-label="Type" className={styles.requestType}>
                    {req.type === 'movie' ? 'Movie' : 'TV Series'}
                  </div>
                  <div data-label="Date" className={styles.requestDate}>
                    {formatDate(req.createdAt)}
                  </div>
                  <div data-label="Status">
                    <StatusBadge
                      status={STATUS_BADGE[req.status] || 'pending'}
                      label={STATUS_MAP[req.status] || 'Unknown'}
                    />
                  </div>
                  <div data-label="Actions" className={styles.actions}>
                    {req.status === 1 && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleRequestAction(req.id, 'approve')}
                          loading={actionLoading === req.id}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRequestAction(req.id, 'decline')}
                          loading={actionLoading === req.id}
                        >
                          Decline
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
