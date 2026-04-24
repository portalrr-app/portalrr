'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface Stats { total: number; active: number; used: number; expired: number }

interface Activity {
  id: string;
  type: 'created' | 'used' | 'expired';
  code: string;
  email?: string;
  createdAt: string;
}

interface ServerHealth {
  id: string;
  name: string;
  type: string;
  healthy: boolean;
  version?: string;
  users?: number;
  streaming?: number;
}

interface PendingRequest {
  id: string;
  email: string;
  username: string;
  message?: string;
  createdAt: string;
}

interface InviteRow {
  id: string;
  code: string;
  label?: string | null;
  uses: number;
  maxUses: number;
  status: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, used: 0, expired: 0 });
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [serverHealth, setServerHealth] = useState<ServerHealth[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [adminName, setAdminName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/invites/stats').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/invites/activity').then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/health').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/invite-requests?status=pending').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/invites?filter=active&take=4').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/admin/me').then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([s, a, h, r, i, me]) => {
      if (s) setStats(s);
      if (Array.isArray(a)) setRecentActivity(a.slice(0, 6));
      if (h?.servers) setServerHealth(h.servers);
      if (r?.requests) setPendingRequests(r.requests.slice(0, 4));
      if (i?.invites) setInvites(i.invites.slice(0, 4));
      if (me?.username) setAdminName(me.username);
    }).finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetch('/api/health').then((r) => r.ok ? r.json() : null).then((h) => {
        if (h?.servers) setServerHealth(h.servers);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const unhealthyServers = serverHealth.filter((s) => !s.healthy);
  const greeting = getGreeting();
  const totalStreaming = serverHealth.reduce((acc, s) => acc + (s.streaming || 0), 0);

  const kpis = useMemo(() => [
    {
      key: 'invites',
      label: 'Invites · active',
      value: stats.active,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      ),
      trend: stats.used > 0 ? `${stats.used} redeemed` : 'Awaiting redemptions',
      sparkColor: 'var(--accent)',
      active: true,
    },
    {
      key: 'used',
      label: 'Invites redeemed',
      value: stats.used,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      trend: `${stats.total} total`,
      sparkColor: 'var(--success)',
    },
    {
      key: 'streaming',
      label: 'Now streaming',
      value: totalStreaming,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
        </svg>
      ),
      trend: `${serverHealth.length} server${serverHealth.length === 1 ? '' : 's'}`,
      sparkColor: '#8ab2ff',
    },
    {
      key: 'requests',
      label: 'Requests pending',
      value: pendingRequests.length,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      trend: pendingRequests.length > 0 ? 'Review queue' : 'All clear',
      sparkColor: 'var(--warning)',
    },
  ], [stats, totalStreaming, serverHealth.length, pendingRequests.length]);

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>{greeting}{adminName ? `, ${capitalize(adminName)}` : ''}</h1>
          <div className="adm-sub">
            {buildSummary(totalStreaming, pendingRequests.length, unhealthyServers.length)}
          </div>
        </div>
        <div className="adm-page-actions">
          <Link href="/admin/logs" className="adm-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            View logs
          </Link>
          <Link href="/admin/invites" className="adm-btn adm-btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New invite
          </Link>
        </div>
      </div>

      {unhealthyServers.length > 0 && (
        <div className={styles.healthBanner}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className={styles.healthBannerContent}>
            <span className={styles.healthBannerTitle}>
              {unhealthyServers.length === serverHealth.length ? 'All servers unreachable' : `${unhealthyServers.length} server${unhealthyServers.length > 1 ? 's' : ''} unreachable`}
            </span>
            <span className={styles.healthBannerServers}>{unhealthyServers.map((s) => s.name).join(', ')}</span>
          </div>
          <Link href="/admin/settings" className={styles.healthBannerLink}>Settings</Link>
        </div>
      )}

      {/* KPI ribbon */}
      <div className={styles.kpis}>
        {kpis.map((kpi) => (
          <div key={kpi.key} className={`${styles.kpi} ${kpi.active ? styles.kpiActive : ''}`}>
            <div className={styles.kpiLabel}>
              {kpi.icon}
              {kpi.label}
            </div>
            <div className={styles.kpiValue}>
              {loading ? <span className={styles.kpiSkeleton} /> : kpi.value}
            </div>
            <div className={styles.kpiTrend}>{kpi.trend}</div>
            <svg className={styles.kpiSpark} viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
              <polyline
                points="0,26 10,22 20,24 30,18 40,20 50,14 60,15 70,10 80,12 90,6 100,8"
                fill="none"
                stroke={kpi.sparkColor}
                strokeWidth="1.8"
              />
            </svg>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className={styles.grid}>
        <div className={styles.col}>
          {/* Recent activity */}
          <div className="adm-card">
            <div className="adm-card-head">
              <h3>Recent activity</h3>
              <Link href="/admin/logs" className="adm-link">View timeline →</Link>
            </div>
            <div className="adm-card-body adm-tight">
              <div className={styles.activity}>
                {loading ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className={styles.activityRow}>
                      <div className={styles.activityIcon} />
                      <div className={styles.activityMain}>
                        <div className={`${styles.activitySkeleton} ${styles.activitySkeletonLg}`} />
                        <div className={styles.activitySkeleton} />
                      </div>
                    </div>
                  ))
                ) : recentActivity.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No recent activity.</p>
                    <Link href="/admin/invites" className="adm-btn adm-btn-sm">Create an invite</Link>
                  </div>
                ) : (
                  recentActivity.map((a) => (
                    <div key={a.id} className={styles.activityRow}>
                      <div className={`${styles.activityIcon} ${styles[`activity_${a.type}`] || ''}`}>
                        <ActivityIcon type={a.type} />
                      </div>
                      <div className={styles.activityMain}>
                        <div className={styles.activityText}>
                          {a.type === 'created' && <>New invite <span className="adm-code">{a.code}</span></>}
                          {a.type === 'used' && <><b>{a.email || 'Someone'}</b> redeemed <span className="adm-code">{a.code}</span></>}
                          {a.type === 'expired' && <>Invite <span className="adm-code">{a.code}</span> expired</>}
                        </div>
                      </div>
                      <div className={styles.activityTime}>{formatRelative(a.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Active invites */}
          <div className="adm-card">
            <div className="adm-card-head">
              <h3>
                Active invites {stats.active > 0 && <span className="adm-pill">{stats.active} live</span>}
              </h3>
              <Link href="/admin/invites" className="adm-link">Manage →</Link>
            </div>
            <div className="adm-card-body adm-tight">
              {invites.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No active invites.</p>
                </div>
              ) : (
                invites.map((inv) => (
                  <div key={inv.id} className={styles.inviteRow}>
                    <div className={styles.inviteInfo}>
                      <span className="adm-code" title={inv.code}>{inv.code}</span>
                      {inv.label && <span className={styles.inviteLabel}>{inv.label}</span>}
                    </div>
                    <div className={styles.inviteMeter}>
                      <i
                        style={{
                          width: `${inv.maxUses === 0 ? 0 : Math.min(100, (inv.uses / inv.maxUses) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className={styles.inviteUses}>
                      {inv.uses}/{inv.maxUses === 0 ? '∞' : inv.maxUses}
                    </div>
                    <span className={`adm-status ${inv.status === 'active' ? 'ok' : 'err'}`}>
                      <span className="adm-d" />
                      {inv.status === 'active' ? 'Active' : 'Used'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.col}>
          {/* Servers */}
          <div className="adm-card">
            <div className="adm-card-head">
              <h3>Servers</h3>
              {serverHealth.length > 0 && (
                <span className="adm-pill">
                  {serverHealth.filter((s) => s.healthy).length}/{serverHealth.length} online
                </span>
              )}
            </div>
            <div className="adm-card-body adm-tight">
              {serverHealth.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No servers configured.</p>
                  <Link href="/admin/settings" className="adm-btn adm-btn-sm">Add a server</Link>
                </div>
              ) : (
                serverHealth.map((s) => (
                  <div key={s.id} className={styles.serverRow}>
                    <div className={`${styles.serverLogo} ${styles[`srv_${s.type}`] || ''}`}>
                      {s.type === 'plex' ? 'P' : s.type === 'jellyfin' ? 'J' : 'E'}
                    </div>
                    <div className={styles.serverMain}>
                      <div className={styles.serverName}>{s.name}</div>
                      <div className={styles.serverSub}>
                        {s.type} {s.version ? `· v${s.version}` : ''}
                      </div>
                    </div>
                    <span className={`adm-status ${s.healthy ? 'ok' : 'err'}`}>
                      <span className="adm-d" />
                      {s.healthy ? 'Healthy' : 'Down'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending requests */}
          <div className="adm-card">
            <div className="adm-card-head">
              <h3>
                Pending requests {pendingRequests.length > 0 && <span className="adm-pill">{pendingRequests.length}</span>}
              </h3>
              {pendingRequests.length > 0 && (
                <Link href="/admin/requests" className="adm-link">Review →</Link>
              )}
            </div>
            <div className="adm-card-body adm-tight">
              {pendingRequests.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No pending requests.</p>
                </div>
              ) : (
                pendingRequests.map((r) => (
                  <Link key={r.id} href="/admin/requests" className={styles.requestRow}>
                    <div className={styles.requestAvatar}>{(r.username || r.email || '?').slice(0, 2).toUpperCase()}</div>
                    <div className={styles.requestMain}>
                      <div className={styles.requestTitle}>{r.username || r.email}</div>
                      <div className={styles.requestMeta}>
                        {r.message ? r.message.slice(0, 40) + (r.message.length > 40 ? '…' : '') : 'Requesting access'}
                      </div>
                    </div>
                    <div className={styles.requestTime}>{formatRelative(r.createdAt)}</div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="adm-card">
            <div className="adm-card-head">
              <h3>Quick actions</h3>
            </div>
            <div className={styles.quickGrid}>
              <Link href="/admin/invites" className={`${styles.quickAction}`}>
                <div className={styles.quickIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <b>New invite</b>
                <span>Generate a code</span>
              </Link>
              <Link href="/admin/users" className={`${styles.quickAction} ${styles.quickAlt}`}>
                <div className={styles.quickIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <b>Manage users</b>
                <span>Directory &amp; access</span>
              </Link>
              <Link href="/admin/onboarding" className={`${styles.quickAction} ${styles.quickAlt2}`}>
                <div className={styles.quickIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </div>
                <b>Onboarding</b>
                <span>Tune the flow</span>
              </Link>
              <Link href="/admin/settings" className={`${styles.quickAction} ${styles.quickAlt3}`}>
                <div className={styles.quickIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33" />
                  </svg>
                </div>
                <b>Settings</b>
                <span>Servers, mail, theme</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footStrip}>
        <span>Portalrr <b>v1.2.0</b></span>
        <span>servers: <b>{serverHealth.length}</b></span>
        <span>queue: <b>idle</b></span>
        <span>last refresh: <b>live</b></span>
        <span className={styles.footAside}>/admin · made with ♡ in a dark room</span>
      </div>
    </div>
  );
}

function ActivityIcon({ type }: { type: 'created' | 'used' | 'expired' }) {
  if (type === 'created') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    );
  }
  if (type === 'used') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Night owl mode';
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildSummary(streams: number, requests: number, unhealthy: number) {
  const bits: string[] = [];
  if (streams > 0) bits.push(`${streams} stream${streams === 1 ? '' : 's'} live`);
  if (requests > 0) bits.push(`${requests} request${requests === 1 ? '' : 's'} need review`);
  if (unhealthy > 0) bits.push(`${unhealthy} server${unhealthy === 1 ? '' : 's'} down`);
  if (bits.length === 0) return 'Everything is humming. Nothing urgent.';
  return bits.join(' · ') + '.';
}

function formatRelative(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}
