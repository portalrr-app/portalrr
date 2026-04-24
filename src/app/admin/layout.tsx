'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ToastProvider } from '@/hooks/useToast';
import { applyAccentColor, applyFonts } from '@/lib/theme';
import {
  DashboardIcon, InvitesIcon, UsersIcon, RequestsIcon, StatsIcon,
  OnboardingIcon, NotificationsIcon, AppearanceIcon, SettingsIcon,
  AdminAccountsIcon, AuditLogIcon, MyAccountIcon, BackToSiteIcon,
  LogoutIcon, MenuIcon, CloseIcon,
} from '@/components/AdminIcons';
import styles from './layout.module.css';
import './admin.css';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  count?: number | null;
}
interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [admin, setAdmin] = useState<{ username: string } | null>(null);
  const [serverInfo, setServerInfo] = useState<{ name: string; count: number; users: number } | null>(null);
  const [counts, setCounts] = useState<{ invites: number; users: number; requests: number; notifications: number }>({
    invites: 0, users: 0, requests: 0, notifications: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const modKey = e.metaKey || e.ctrlKey;
      if (modKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reflect the current URL's ?q= in the top-bar box so it stays in sync after
  // navigation (e.g. landing on /admin/invites?q=foo shows "foo" in the search).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URL(window.location.href).searchParams.get('q') || '';
    setSearchQuery(q);
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    const destination = pickSearchDestination(q, pathname);
    const href = q ? `${destination}?q=${encodeURIComponent(q)}` : destination;
    router.push(href);
  };

  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/setup';

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isAuthPage) {
      setAuthChecked(true);
      return;
    }
    fetch('/api/settings', { method: 'GET' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/admin/login');
        } else {
          setAuthChecked(true);
        }
      })
      .catch(() => { router.replace('/admin/login'); });
  }, [isAuthPage, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  useEffect(() => {
    const applyTheme = async () => {
      try {
        const match = document.cookie.match(/accent_color=([^;]+)/);
        if (match) {
          const raw = decodeURIComponent(match[1]);
          try {
            const parsed = JSON.parse(raw);
            if (parsed.color) applyAccentColor(parsed.color);
          } catch {
            applyAccentColor(raw);
          }
        }
        const res = await fetch('/api/settings/public');
        if (res.ok) {
          const data = await res.json();
          if (data.accentColor) applyAccentColor(data.accentColor);
          applyFonts(data.fontFamily, data.fontDisplay);
        }
      } catch { /* ignore */ }
    };
    applyTheme();
  }, []);

  useEffect(() => {
    if (isAuthPage || !authChecked) return;
    Promise.all([
      fetch('/api/admin/me').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/servers').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/invites?filter=active&take=1').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/users?take=1').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/invite-requests?status=pending&take=1').then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([me, servers, invites, users, requests]) => {
      if (me?.username) setAdmin({ username: me.username });
      if (Array.isArray(servers) && servers.length > 0) {
        const active = servers.filter((s: { isActive: boolean }) => s.isActive).length;
        setServerInfo({
          name: servers[0]?.name || 'Workspace',
          count: active || servers.length,
          users: users?.total || 0,
        });
      }
      setCounts({
        invites: invites?.total ?? 0,
        users: users?.total ?? 0,
        requests: requests?.total ?? 0,
        notifications: 0,
      });
    });
  }, [isAuthPage, authChecked]);

  const navGroups: NavGroup[] = useMemo(() => [
    {
      label: null,
      items: [{ href: '/admin', label: 'Dashboard', icon: <DashboardIcon /> }],
    },
    {
      label: 'Manage',
      items: [
        { href: '/admin/invites', label: 'Invites', icon: <InvitesIcon />, count: counts.invites || null },
        { href: '/admin/users', label: 'Users', icon: <UsersIcon />, count: counts.users || null },
        { href: '/admin/requests', label: 'Requests', icon: <RequestsIcon />, count: counts.requests || null },
        { href: '/admin/stats', label: 'Stats', icon: <StatsIcon /> },
      ],
    },
    {
      label: 'Configure',
      items: [
        { href: '/admin/onboarding', label: 'Onboarding', icon: <OnboardingIcon /> },
        { href: '/admin/notifications', label: 'Notifications', icon: <NotificationsIcon />, count: counts.notifications || null },
        { href: '/admin/appearance', label: 'Appearance', icon: <AppearanceIcon /> },
        { href: '/admin/settings', label: 'Settings', icon: <SettingsIcon /> },
      ],
    },
    {
      label: 'System',
      items: [
        { href: '/admin/accounts', label: 'Admin accounts', icon: <AdminAccountsIcon /> },
        { href: '/admin/logs', label: 'Audit log', icon: <AuditLogIcon /> },
      ],
    },
  ], [counts]);

  const crumbs = useMemo(() => buildCrumbs(pathname), [pathname]);
  const adminInitials = (admin?.username || 'A').slice(0, 2).toUpperCase();

  if (isAuthPage) return <>{children}</>;

  if (!authChecked) {
    return (
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <PortalrrLogo />
            <div className={styles.brandText}>
              <b>Portalrr</b>
              <em>Control room</em>
            </div>
          </div>
          <nav className={styles.nav}>
            <div className={styles.loadingPulse} />
            <div className={styles.loadingPulse} />
            <div className={styles.loadingPulse} />
          </nav>
        </aside>
        <main className={styles.main}>
          <div className={styles.loadingPulse} style={{ width: 200, height: 24, marginBottom: 8 }} />
          <div className={styles.loadingPulse} style={{ width: 300, height: 16 }} />
        </main>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className={styles.layout}>
        <div className={styles.aurora} aria-hidden="true" />

        <button
          className={styles.menuToggle}
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
        <div
          className={`${styles.sidebarOverlay} ${sidebarOpen ? styles.visible : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
          <div className={styles.brand}>
            <PortalrrLogo />
            <div className={styles.brandText}>
              <b>Portalrr</b>
              <em>Control room</em>
            </div>
          </div>

          {serverInfo && (
            <div className={styles.serverSwitch} title="Switch workspace">
              <span className={styles.serverDot} />
              <div className={styles.serverMeta}>
                <div className={styles.serverName}>{serverInfo.name}</div>
                <div className={styles.serverSub}>
                  {serverInfo.count} server{serverInfo.count === 1 ? '' : 's'} · {serverInfo.users} user{serverInfo.users === 1 ? '' : 's'}
                </div>
              </div>
              <svg className={styles.serverChev} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="8 9 12 5 16 9" />
                <polyline points="8 15 12 19 16 15" />
              </svg>
            </div>
          )}

          <nav className={styles.nav}>
            {navGroups.map((group, gi) => (
              <div key={gi} className={styles.navGroup}>
                {group.label && <div className={styles.navGroupLabel}>{group.label}</div>}
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.navLink} ${active ? styles.navActive : ''}`}
                    >
                      {item.icon}
                      <span className={styles.navText}>{item.label}</span>
                      {item.count ? <span className={styles.navCount}>{item.count}</span> : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className={styles.sideFoot}>
            <Link
              href="/admin/my-account"
              className={`${styles.me} ${pathname === '/admin/my-account' ? styles.meActive : ''}`}
            >
              <span className={styles.meAv}>{adminInitials}</span>
              <div className={styles.meWho}>
                <b>{admin?.username || 'Admin'}</b>
                <em>My account</em>
              </div>
              <MyAccountIcon />
            </Link>
            <div className={styles.meLinks}>
              <Link href="/" className={styles.meLink}>
                <BackToSiteIcon />
                <span>Back to site</span>
              </Link>
              <button onClick={handleLogout} className={styles.meLink}>
                <LogoutIcon />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.top}>
            <div className={styles.crumbs}>
              {crumbs.map((c, i) => (
                <span key={i} className={styles.crumbItem}>
                  {i === 0 ? <b>{c}</b> : c}
                  {i < crumbs.length - 1 && <span className={styles.crumbSep}>/</span>}
                </span>
              ))}
            </div>
            <form className={styles.search} onSubmit={handleSearchSubmit} role="search">
              <span className={styles.searchIco}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users, invites, logs…"
                aria-label="Search admin"
              />
              <span className={styles.searchKbd}>
                <span>⌘</span><span>K</span>
              </span>
            </form>
            <div className={styles.topActions}>
              <Link href="/admin/notifications" className={styles.iconbtn} aria-label="Notifications">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {counts.notifications > 0 && <span className={styles.iconbtnPip} />}
              </Link>
              <Link href="/admin/logs" className={styles.iconbtn} aria-label="Activity">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </Link>
            </div>
          </div>
          <div className={styles.page}>{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}

function PortalrrLogo() {
  return (
    <div className={styles.logoIcon}>
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="4" style={{ fill: 'var(--accent)' }} />
        <rect x="7" y="7" width="10" height="10" rx="2.5" style={{ fill: '#0A0A0A' }} />
        <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" style={{ fill: 'var(--accent)' }} />
      </svg>
    </div>
  );
}

function pickSearchDestination(query: string, pathname: string): string {
  const searchableRoutes = ['/admin/invites', '/admin/users', '/admin/requests', '/admin/logs'];
  // Already on a searchable page? Stay there so the filter applies in-place.
  if (searchableRoutes.includes(pathname)) return pathname;
  // Otherwise, default to invites — it's the most common lookup target.
  return '/admin/invites';
}

function buildCrumbs(pathname: string): string[] {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === 'admin')) {
    return ['Admin', 'Dashboard'];
  }
  const titleCase = (s: string) => s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return parts.map(titleCase);
}
