'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

interface UserStats {
  userId: string;
  userName: string;
  totalWatchTime: number;
  itemsWatched: number;
  lastActivity: string;
}

interface Stream {
  sessionId: string;
  userId: string;
  username: string;
  client: string;
  device: string;
  title: string;
  type: string;
  year?: number;
  progress: number;
  isPaused: boolean;
  playMethod: string;
}

interface Server {
  id: string;
  name: string;
  type: 'plex' | 'jellyfin';
}

export default function StatsPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/servers')
      .then(res => {
        if (!res.ok) return [];
        return res.json();
      })
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setServers(list);
        if (list.length > 0) setSelectedServer(list[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!selectedServer) {
      setLoading(false);
      return;
    }

    const loadStats = async () => {
      try {
        const res = await fetch(`/api/stats?serverId=${selectedServer}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setUserStats(data.userStats || []);
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [selectedServer]);

  useEffect(() => {
    let cancelled = false;

    const loadStreams = async () => {
      try {
        const res = await fetch('/api/activity?type=streams');
        const data = await res.json();
        if (!cancelled) {
          setStreams(data.streams || []);
        }
      } catch {}
    };

    void loadStreams();
    const interval = setInterval(() => {
      void loadStreams();
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '-';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
  };

  const totalWatchTime = userStats.reduce((acc, u) => acc + u.totalWatchTime, 0);
  const totalItemsWatched = userStats.reduce((acc, u) => acc + u.itemsWatched, 0);

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Stats</h1>
          <div className="adm-sub">Server statistics and active streams.</div>
        </div>
        <select
          className={styles.serverSelect}
          value={selectedServer}
          onChange={(e) => setSelectedServer(e.target.value)}
        >
          {servers.map((server) => (
            <option key={server.id} value={server.id}>
              {server.name} ({server.type})
            </option>
          ))}
        </select>
      </div>

      {servers.length === 0 && !loading && (
        <div className={styles.emptyState}>No servers configured. Add a server in Settings to see stats.</div>
      )}

      {/* Active Streams */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Active Streams
          {streams.length > 0 && <span className={styles.streamBadge}>{streams.length}</span>}
        </h2>
        {streams.length === 0 ? (
          <div className={styles.emptyState}>No active streams</div>
        ) : (
          <div className={styles.streamsList}>
            {streams.map((stream) => (
              <div key={stream.sessionId} className={styles.streamCard}>
                <div className={styles.streamUser}>
                  <div className={styles.streamAvatar}>
                    {stream.username.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.streamInfo}>
                    <div className={styles.streamUsername}>{stream.username}</div>
                    <div className={styles.streamTitle}>{stream.title}</div>
                  </div>
                </div>
                <div className={styles.streamRight}>
                  <div className={styles.streamMeta}>
                    <span className={styles.streamDevice}>{stream.client}</span>
                    <span className={styles.streamMethod}>{stream.playMethod}</span>
                  </div>
                  <div className={styles.streamProgress}>
                    <div className={styles.streamProgressBar}>
                      <div className={styles.streamProgressFill} style={{ width: `${stream.progress}%` }} />
                    </div>
                    <span className={`${styles.streamState} ${stream.isPaused ? styles.streamPaused : styles.streamPlaying}`}>
                      {stream.isPaused ? 'Paused' : 'Playing'} &middot; {stream.progress}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}>Loading statistics...</div>
      ) : (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{userStats.length}</div>
              <div className={styles.statLabel}>Users</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{formatDuration(totalWatchTime)}</div>
              <div className={styles.statLabel}>Total Watch Time</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{totalItemsWatched}</div>
              <div className={styles.statLabel}>Items Watched</div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>User Watch Stats</h2>
            <div className={`${styles.table} ${styles.userTable}`}>
              <div className={styles.tableHeader}>
                <div>User</div>
                <div>Total Hours</div>
                <div>Items Watched</div>
                <div>Last Activity</div>
              </div>
              {userStats.length === 0 ? (
                <div className={styles.emptyState}>No user data available</div>
              ) : (
                userStats.map((user) => (
                  <div key={user.userId} className={styles.tableRow}>
                    <div className={styles.userName}>{user.userName}</div>
                    <div className={styles.totalHours}>{formatDuration(user.totalWatchTime)}</div>
                    <div className={styles.itemsWatched}>{user.itemsWatched}</div>
                    <div className={styles.lastActivity}>{formatTimeAgo(user.lastActivity)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
