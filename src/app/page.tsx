'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@/components';
import { useAppearance } from '@/hooks/useAppearance';
import styles from './page.module.css';

function InviteHandler({ onCode }: { onCode: (code: string) => void }) {
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const inviteCode = searchParams.get('invite');
    if (inviteCode) {
      handled.current = true;
      onCode(inviteCode);
    }
  }, [searchParams, onCode]);

  return null;
}

export default function Home() {
  const router = useRouter();
  const { appearance } = useAppearance();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/invites/verify/${codeToVerify}`);
      const data = await res.json();

      if (res.ok && data.valid) {
        router.push(`/register/${codeToVerify}`);
      } else {
        setError(data.message || 'Invalid invite code');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify(code);
  };

  const handleVerifyRef = useRef(handleVerify);
  handleVerifyRef.current = handleVerify;

  const handleInviteCode = useCallback((c: string) => {
    setCode(c);
    handleVerifyRef.current(c);
  }, []);

  const bgStyle: React.CSSProperties = {};
  if (appearance?.backgroundStyle === 'image' && appearance.backgroundImageUrl) {
    bgStyle.backgroundImage = `url(${appearance.backgroundImageUrl})`;
  }

  return (
    <div
      className={styles.container}
      data-animations={appearance?.enableAnimations !== false ? 'on' : 'off'}
      data-card-width={appearance?.cardWidth || 'default'}
      data-button-style={appearance?.buttonStyle || 'rounded'}
      data-input-style={appearance?.inputStyle || 'outlined'}
    >
      <div
        className={styles.background}
        data-bg-style={appearance?.backgroundStyle || 'gradient'}
        data-gradient-dir={appearance?.gradientDirection || 'top'}
        data-noise={appearance?.enableNoise !== false ? 'on' : 'off'}
        style={{
          ...(appearance?.backgroundStyle === 'image' && appearance.backgroundImageUrl
            ? { backgroundImage: `url(${appearance.backgroundImageUrl})` }
            : {}),
          ...({ '--bg-overlay-opacity': appearance?.backgroundOverlay ?? 0.7 } as React.CSSProperties),
        }}
      />

      <div className={styles.content}>
        <div className={styles.logo}>
          {appearance?.logoMode !== 'none' && (
            <>
              {appearance?.logoMode === 'image' && appearance?.logoUrl ? (
                <img src={appearance.logoUrl} alt="" className={styles.logoImage} />
              ) : (
                <div className={styles.logoIcon}>
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="18" height="18" rx="4" style={{ fill: 'var(--accent)' }} />
                    <rect x="7" y="7" width="10" height="10" rx="2.5" style={{ fill: '#0A0A0A' }} />
                    <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" style={{ fill: 'var(--accent)' }} />
                  </svg>
                </div>
              )}
            </>
          )}
          <span className={styles.logoText}>{appearance?.appName || 'Portalrr'}</span>
        </div>

        <div className={styles.card} data-card-style={appearance?.cardStyle || 'bordered'}>
          <div className={styles.welcome}>
            <h1 className={styles.title}>{appearance?.welcomeTitle || 'Welcome'}</h1>
            <p className={styles.subtitle}>
              {appearance?.subtitleText || 'Enter your invite code to join the server'}
            </p>
          </div>

          <Suspense fallback={null}>
            <InviteHandler onCode={handleInviteCode} />
          </Suspense>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Invite Code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              error={error}
              autoComplete="off"
              autoFocus={!code}
            />
            <Button type="submit" fullWidth loading={loading}>
              {appearance?.buttonText || 'Continue'}
            </Button>
          </form>
        </div>

        <div className={styles.footer}>
          {appearance?.footerText && (
            <span className={styles.footerText}>{appearance.footerText}</span>
          )}
          <div className={styles.footerLinks}>
            <a href="/account" className={styles.accountLink}>
              My Account
            </a>
            {!appearance?.hideAdminLink && (
              <a href="/admin" className={styles.adminLink}>
                Admin login
              </a>
            )}
          </div>
        </div>
      </div>

      <div className={styles.branding} data-portalrr-branding="">
        Powered by&nbsp;<span className={styles.brandingName}>Portalrr</span>
      </div>
    </div>
  );
}
