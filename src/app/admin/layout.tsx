'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ToastProvider } from '@/hooks/useToast';
import { applyAccentColor, applyFonts } from '@/lib/theme';
import {
  DashboardIcon, InvitesIcon, UsersIcon, RequestsIcon, StatsIcon,
  OnboardingIcon, NotificationsIcon, AppearanceIcon, SettingsIcon,
  AdminAccountsIcon, AuditLogIcon, MyAccountIcon, BackToSiteIcon,
  LogoutIcon, MenuIcon, CloseIcon,
} from '@/components/AdminIcons';
import styles from './layout.module.css';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Setup and login pages render without the admin shell
  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/setup';

  // Auth guard: redirect to login if not authenticated (skip for auth pages)
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
      .catch(() => {
        router.replace('/admin/login');
      });
  }, [isAuthPage, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  useEffect(() => {
    const applyTheme = async () => {
      try {
        // Try cookie first for instant color
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
        // Always fetch settings for fonts + fresh accent color
        const res = await fetch('/api/settings/public');
        if (res.ok) {
          const data = await res.json();
          if (data.accentColor) applyAccentColor(data.accentColor);
          applyFonts(data.fontFamily, data.fontDisplay);
        }
      } catch {}
    };
    applyTheme();
  }, []);

  const navGroups = [
    {
      label: null,
      items: [
        { href: '/admin', label: 'Dashboard', icon: <DashboardIcon /> },
      ],
    },
    {
      label: 'Manage',
      items: [
        { href: '/admin/invites', label: 'Invites', icon: <InvitesIcon /> },
        { href: '/admin/users', label: 'Users', icon: <UsersIcon /> },
        { href: '/admin/requests', label: 'Requests', icon: <RequestsIcon /> },
        { href: '/admin/stats', label: 'Stats', icon: <StatsIcon /> },
      ],
    },
    {
      label: 'Configure',
      items: [
        { href: '/admin/onboarding', label: 'Onboarding', icon: <OnboardingIcon /> },
        { href: '/admin/notifications', label: 'Notifications', icon: <NotificationsIcon /> },
        { href: '/admin/appearance', label: 'Appearance', icon: <AppearanceIcon /> },
        { href: '/admin/settings', label: 'Settings', icon: <SettingsIcon /> },
      ],
    },
    {
      label: 'System',
      items: [
        { href: '/admin/accounts', label: 'Admin Accounts', icon: <AdminAccountsIcon /> },
        { href: '/admin/logs', label: 'Audit Log', icon: <AuditLogIcon /> },
      ],
    },
  ];

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (!authChecked) {
    return (
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.logo}>
              <div className={styles.logoIcon}>
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="18" height="18" rx="4" style={{ fill: 'var(--accent)' }} />
                  <rect x="7" y="7" width="10" height="10" rx="2.5" style={{ fill: '#0A0A0A' }} />
                  <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" style={{ fill: 'var(--accent)' }} />
                </svg>
              </div>
              <span className={styles.logoText}>Portalrr</span>
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
        <button
          className={styles.menuToggle}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
        <div
          className={`${styles.sidebarOverlay} ${sidebarOpen ? styles.visible : ''}`}
          onClick={() => setSidebarOpen(false)}
        />
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
          <div className={styles.sidebarHeader}>
            <div className={styles.logo}>
              <div className={styles.logoIcon}>
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="18" height="18" rx="4" style={{ fill: 'var(--accent)' }} />
                  <rect x="7" y="7" width="10" height="10" rx="2.5" style={{ fill: '#0A0A0A' }} />
                  <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" style={{ fill: 'var(--accent)' }} />
                </svg>
              </div>
              <span className={styles.logoText}>Portalrr</span>
            </div>
          </div>

          <nav className={styles.nav}>
            {navGroups.map((group, gi) => (
              <div key={gi}>
                {group.label && <div className={styles.navGroup}>{group.label}</div>}
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.navLink} ${
                      pathname === item.href ? styles.active : ''
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className={styles.sidebarFooter}>
            <Link
              href="/admin/my-account"
              className={`${styles.logoutButton} ${pathname === '/admin/my-account' ? styles.footerActive : ''}`}
            >
              <MyAccountIcon />
              My Account
            </Link>
            <Link href="/" className={styles.logoutButton}>
              <BackToSiteIcon />
              Back to Site
            </Link>
            <button onClick={handleLogout} className={styles.logoutButton}>
              <LogoutIcon />
              Logout
            </button>
          </div>
        </aside>

        <main className={styles.main}>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
