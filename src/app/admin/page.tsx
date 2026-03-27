'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Skeleton } from '@/components';
import { PlusIcon, UsersIcon, SettingsIcon } from '@/components/AdminIcons';
import styles from './page.module.css';

interface Stats {
  total: number;
  active: number;
  used: number;
  expired: number;
}

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
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, used: 0, expired: 0 });
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverHealth, setServerHealth] = useState<ServerHealth[]>([]);
  const [healthChecked, setHealthChecked] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setServerHealth(data.servers || []);
      }
    } catch {
      // Silently fail
    } finally {
      setHealthChecked(true);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        fetch('/api/invites/stats'),
        fetch('/api/invites/activity'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setRecentActivity(activityData);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unhealthyServers = serverHealth.filter(s => !s.healthy);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>Dashboard</h1>
          <p className={styles.headerSubtitle}>Overview of your invite system</p>
        </div>
        <Link href="/admin/invites">
          <Button>Create Invite</Button>
        </Link>
      </div>

      {healthChecked && unhealthyServers.length > 0 && (
        <div className={styles.healthBanner}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className={styles.healthBannerContent}>
            <span className={styles.healthBannerTitle}>
              {unhealthyServers.length === serverHealth.length
                ? 'All servers unreachable'
                : `${unhealthyServers.length} server${unhealthyServers.length > 1 ? 's' : ''} unreachable`}
            </span>
            <span className={styles.healthBannerServers}>
              {unhealthyServers.map(s => s.name).join(', ')}
            </span>
          </div>
          <Link href="/admin/settings" className={styles.healthBannerLink}>
            Settings
          </Link>
        </div>
      )}

      <div className={styles.statsBar}>
        {(['total', 'active', 'used', 'expired'] as const).map((key) => (
          <div key={key} className={styles.stat}>
            <div className={styles.statValue}>
              {loading ? <Skeleton width={40} height={28} /> : stats[key]}
            </div>
            <div className={styles.statLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</div>
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Activity</h2>
            <Link href="/admin/invites" className={styles.viewAll}>
              View all
            </Link>
          </div>

          <div className={styles.activityList}>
            {loading ? (
              <div className={styles.activitySkeletons}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className={styles.activityItem}>
                    <Skeleton width={8} height={8} borderRadius="50%" />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Skeleton width="80%" height={16} />
                      <Skeleton width={60} height={12} />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No activity yet.</p>
                <Link href="/admin/invites">
                  <Button size="sm">Create your first invite</Button>
                </Link>
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className={styles.activityItem}>
                  <div className={`${styles.activityDot} ${styles[activity.type]}`} />
                  <div className={styles.activityContent}>
                    <div className={styles.activityText}>
                      {activity.type === 'created' && `Invite created: ${activity.code}`}
                      {activity.type === 'used' && `Invite used by ${activity.email || 'someone'}`}
                      {activity.type === 'expired' && `Invite expired: ${activity.code}`}
                    </div>
                    <div className={styles.activityMeta}>{formatDate(activity.createdAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.sidebar}>
          <div>
            <h3 className={styles.sectionTitle} style={{ marginBottom: 10 }}>Quick Actions</h3>
            <div className={styles.quickActions}>
              <Link href="/admin/invites" className={styles.quickAction}>
                <PlusIcon />
                New Invite
              </Link>
              <Link href="/admin/users" className={styles.quickAction}>
                <UsersIcon />
                Manage Users
              </Link>
              <Link href="/admin/settings" className={styles.quickAction}>
                <SettingsIcon />
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
