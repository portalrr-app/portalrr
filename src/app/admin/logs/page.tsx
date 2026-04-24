'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import styles from './page.module.css';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AuditEntry {
  id: string;
  timestamp: string;
  event: string;
  actor: string;
  target: string;
  details: Record<string, unknown> | null;
  ip: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
}

interface Session {
  id: string;
  user: string;
  type: 'admin' | 'user';
  ip: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const EVENT_TYPES = [
  'all',
  'login',
  'logout',
  'invite.created',
  'invite.used',
  'invite.revoked',
  'invite.expired',
  'user.created',
  'user.deleted',
  'user.updated',
  'settings.updated',
  'session.revoked',
  'audit.purged',
] as const;

const EVENT_COLORS: Record<string, { bg: string; fg: string }> = {
  login:             { bg: '#22C55E18', fg: '#22C55E' },
  logout:            { bg: '#A0A0A018', fg: '#A0A0A0' },
  'invite.created':  { bg: '#4FC3F718', fg: '#4FC3F7' },
  'invite.used':     { bg: '#22C55E18', fg: '#22C55E' },
  'invite.revoked':  { bg: '#EF444418', fg: '#EF4444' },
  'invite.expired':  { bg: '#F59E0B18', fg: '#F59E0B' },
  'user.created':    { bg: '#A78BFA18', fg: '#A78BFA' },
  'user.deleted':    { bg: '#EF444418', fg: '#EF4444' },
  'user.updated':    { bg: '#4FC3F718', fg: '#4FC3F7' },
  'settings.updated':{ bg: '#F59E0B18', fg: '#F59E0B' },
  'session.revoked': { bg: '#EF444418', fg: '#EF4444' },
  'audit.purged':    { bg: '#EF444418', fg: '#EF4444' },
};

const DEFAULT_EVENT_COLOR = { bg: '#A0A0A018', fg: '#A0A0A0' };
const LIMIT = 50;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function truncateUA(ua: string, max = 60): string {
  return ua.length > max ? ua.slice(0, max) + '...' : ua;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LogsPage() {
  /* -- Audit log state -- */
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loadingAudit, setLoadingAudit] = useState(true);

  const [eventFilter, setEventFilter] = useState('all');
  const [actorSearch, setActorSearch] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URL(window.location.href).searchParams.get('q') || '';
    if (q) setActorSearch(q);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  /* -- Purge state -- */
  const [showPurge, setShowPurge] = useState(false);
  const [purgeDays, setPurgeDays] = useState(90);
  const [purging, setPurging] = useState(false);

  /* -- Sessions state -- */
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  /* -- Active section tab -- */
  const [activeTab, setActiveTab] = useState<'audit' | 'sessions'>('audit');

  const actorDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Fetch audit log                                                  */
  /* ---------------------------------------------------------------- */

  const fetchAudit = useCallback(async (p: number) => {
    setLoadingAudit(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (eventFilter !== 'all') params.set('event', eventFilter);
      if (actorSearch.trim()) params.set('actor', actorSearch.trim());
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await fetch(`/api/admin/audit-log?${params}`);
      if (!res.ok) throw new Error('fetch failed');
      const data: AuditResponse = await res.json();

      setEntries(data.entries ?? []);
      setTotalEntries(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setPage(data.page ?? 1);
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    } finally {
      setLoadingAudit(false);
    }
  }, [eventFilter, actorSearch, dateFrom, dateTo]);

  useEffect(() => { fetchAudit(1); }, [fetchAudit]);

  /* ---------------------------------------------------------------- */
  /*  Fetch sessions                                                   */
  /* ---------------------------------------------------------------- */

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/admin/sessions');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'sessions') fetchSessions();
  }, [activeTab, fetchSessions]);

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */

  const handlePurge = async () => {
    setPurging(true);
    try {
      const res = await fetch('/api/admin/audit-log', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanDays: purgeDays }),
      });
      if (!res.ok) throw new Error('purge failed');
      setShowPurge(false);
      fetchAudit(1);
    } catch (err) {
      console.error('Purge failed:', err);
    } finally {
      setPurging(false);
    }
  };

  const handleRevokeSession = async (sessionId: string, type: string) => {
    setRevokingId(sessionId);
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, type }),
      });
      if (!res.ok) throw new Error('revoke failed');
      fetchSessions();
    } catch (err) {
      console.error('Revoke failed:', err);
    } finally {
      setRevokingId(null);
    }
  };

  const handleActorSearch = (value: string) => {
    if (actorDebounce.current) clearTimeout(actorDebounce.current);
    actorDebounce.current = setTimeout(() => {
      setActorSearch(value);
    }, 300);
  };

  /* ---------------------------------------------------------------- */
  /*  Pagination helpers                                               */
  /* ---------------------------------------------------------------- */

  function pageNumbers(): (number | '...')[] {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div>
      {/* Header */}
      <div className="adm-page-head">
        <div>
          <h1>Audit log</h1>
          <div className="adm-sub">
            Every action taken on your portal. Security events, sessions, and system activity.
            {activeTab === 'audit' && !loadingAudit && totalEntries > 0 && (
              <> · <b style={{ color: 'var(--text-primary)' }}>{totalEntries.toLocaleString()} entries</b></>
            )}
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'audit' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Audit Log
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'sessions' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          Sessions
        </button>
      </div>

      {/* ============================================================ */}
      {/*  AUDIT LOG TAB                                                */}
      {/* ============================================================ */}
      {activeTab === 'audit' && (
        <>
          {/* Filters */}
          <div className={styles.filters}>
            <select
              className={styles.select}
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t === 'all' ? 'All events' : t}</option>
              ))}
            </select>

            <input
              type="text"
              className={styles.input}
              placeholder="Search actor..."
              value={actorSearch}
              onChange={(e) => handleActorSearch(e.target.value)}
            />

            <input
              type="date"
              className={styles.input}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="From date"
            />
            <input
              type="date"
              className={styles.input}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="To date"
            />

            <button className={styles.purgeButton} onClick={() => setShowPurge(true)}>
              Purge
            </button>
          </div>

          {/* Purge confirmation */}
          {showPurge && (
            <div className={styles.purgeBar}>
              <span className={styles.purgeLabel}>
                Delete entries older than
              </span>
              <input
                type="number"
                className={styles.purgeInput}
                value={purgeDays}
                min={1}
                onChange={(e) => setPurgeDays(Number(e.target.value))}
              />
              <span className={styles.purgeLabel}>days</span>
              <button
                className={styles.purgeConfirm}
                onClick={handlePurge}
                disabled={purging}
              >
                {purging ? 'Purging...' : 'Confirm purge'}
              </button>
              <button
                className={styles.purgeCancel}
                onClick={() => setShowPurge(false)}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Table */}
          <div className={styles.table}>
            <div className={styles.auditHeader}>
              <div>Time</div>
              <div>Event</div>
              <div>Actor</div>
              <div>Target</div>
              <div>Details</div>
              <div>IP</div>
            </div>

            {loadingAudit ? (
              <div className={styles.emptyState}><p>Loading...</p></div>
            ) : entries.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateTitle}>No audit entries</p>
                <p className={styles.emptyStateText}>
                  Security and system events will appear here
                </p>
              </div>
            ) : (
              entries.map((entry) => {
                const color = EVENT_COLORS[entry.event] ?? DEFAULT_EVENT_COLOR;
                const isExpanded = expandedRow === entry.id;
                const hasDetails = entry.details && Object.keys(entry.details).length > 0;

                return (
                  <div key={entry.id}>
                    <div className={styles.auditRow}>
                      <div data-label="Time" className={styles.timeCell} title={formatFullDate(entry.timestamp)}>
                        {relativeTime(entry.timestamp)}
                      </div>
                      <div data-label="Event">
                        <span
                          className={styles.eventBadge}
                          style={{ background: color.bg, color: color.fg }}
                        >
                          {entry.event}
                        </span>
                      </div>
                      <div data-label="Actor" className={styles.mono}>{entry.actor}</div>
                      <div data-label="Target" className={styles.mono}>{entry.target || '\u2014'}</div>
                      <div data-label="Details">
                        {hasDetails ? (
                          <button
                            className={styles.detailsToggle}
                            onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
                          >
                            {isExpanded ? 'Hide' : 'Show'}
                          </button>
                        ) : (
                          <span className={styles.muted}>{'\u2014'}</span>
                        )}
                      </div>
                      <div data-label="IP" className={styles.mono}>{entry.ip || '\u2014'}</div>
                    </div>

                    {isExpanded && hasDetails && (
                      <div className={styles.detailsPane}>
                        <pre className={styles.detailsJson}>
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageButton}
                disabled={page <= 1}
                onClick={() => fetchAudit(page - 1)}
              >
                Prev
              </button>
              {pageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className={styles.ellipsis}>...</span>
                ) : (
                  <button
                    key={p}
                    className={`${styles.pageButton} ${p === page ? styles.pageActive : ''}`}
                    onClick={() => fetchAudit(p)}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                className={styles.pageButton}
                disabled={page >= totalPages}
                onClick={() => fetchAudit(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/*  SESSIONS TAB                                                 */}
      {/* ============================================================ */}
      {activeTab === 'sessions' && (
        <>
          <div className={styles.table}>
            <div className={styles.sessionHeader}>
              <div>User</div>
              <div>Type</div>
              <div>IP</div>
              <div>User Agent</div>
              <div>Created</div>
              <div>Expires</div>
              <div></div>
            </div>

            {loadingSessions ? (
              <div className={styles.emptyState}><p>Loading...</p></div>
            ) : sessions.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateTitle}>No active sessions</p>
                <p className={styles.emptyStateText}>
                  Active admin and user sessions will appear here
                </p>
              </div>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className={styles.sessionRow}>
                  <div data-label="User" className={styles.mono}>{s.user}</div>
                  <div data-label="Type">
                    <span
                      className={styles.typeBadge}
                      data-type={s.type}
                    >
                      {s.type}
                    </span>
                  </div>
                  <div data-label="IP" className={styles.mono}>{s.ip || '\u2014'}</div>
                  <div data-label="User Agent" className={styles.uaCell} title={s.userAgent}>
                    {truncateUA(s.userAgent || '\u2014')}
                  </div>
                  <div data-label="Created" className={styles.timeCell} title={formatFullDate(s.createdAt)}>
                    {relativeTime(s.createdAt)}
                  </div>
                  <div data-label="Expires" className={styles.timeCell} title={formatFullDate(s.expiresAt)}>
                    {relativeTime(s.expiresAt)}
                  </div>
                  <div data-label="">
                    <button
                      className={styles.revokeButton}
                      onClick={() => handleRevokeSession(s.id, s.type)}
                      disabled={revokingId === s.id}
                    >
                      {revokingId === s.id ? 'Revoking...' : 'Revoke'}
                    </button>
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
