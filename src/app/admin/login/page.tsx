'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@/components';
import styles from './page.module.css';

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [totpRequired, setTotpRequired] = useState(false);

  useEffect(() => {
    // Apply accent color from cookie immediately (no flash)
    const applyColor = (c: string) => {
      document.documentElement.style.setProperty('--accent', c);
      document.documentElement.style.setProperty('--accent-hover', c);
      document.documentElement.style.setProperty('--accent-muted', c + '20');
      document.documentElement.style.setProperty('--accent-glow', c + '30');
    };
    try {
      const match = document.cookie.match(/accent_color=([^;]+)/);
      if (match) {
        const raw = decodeURIComponent(match[1]);
        try {
          const parsed = JSON.parse(raw);
          applyColor(parsed.color);
        } catch {
          applyColor(raw);
        }
      }
    } catch {}

    // Fallback: fetch from settings if no cookie
    fetch('/api/settings/public')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.accentColor) applyColor(data.accentColor);
      })
      .catch(() => {});

    fetch('/api/admin/setup')
      .then((res) => res.json())
      .then((data) => {
        if (data.setupRequired) {
          router.replace('/admin/setup');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload: { username: string; password: string; totpCode?: string } = { username, password };
      if (totpRequired && totpCode) {
        payload.totpCode = totpCode;
      }

      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/admin');
      } else if (data.setupRequired) {
        router.replace('/admin/setup');
      } else if (data.totpRequired) {
        setTotpRequired(true);
        setError('');
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  return (
    <div className={styles.container}>
      <div className={styles.background} />

      <div className={styles.content}>
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

        <Card padding="lg" style={{ maxWidth: 400, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>
            Admin Login
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'center' }}>
            Sign in to manage your invites
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={totpRequired ? '' : error}
              autoComplete="current-password"
            />
            {totpRequired && (
              <Input
                label="2FA Code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000"
                error={error}
                autoFocus
              />
            )}
            <Button type="submit" fullWidth loading={loading}>
              Sign In
            </Button>
          </form>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link href="/" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
