'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button, Input, Card } from '@/components';
import FlowBackground from '@/components/FlowBackground';
import { useAppearance } from '@/hooks/useAppearance';
import styles from './page.module.css';

interface ServerInfo {
  id: string;
  name: string;
  type: string;
  disabled?: boolean;
  libraries?: string[];
}

interface UserAccount {
  id: string;
  username: string;
  email: string | null;
  emailRequired?: boolean;
  createdAt: string;
  accessUntil: string | null;
  server: ServerInfo | null;
  servers?: ServerInfo[];
}

interface ReferralInvite {
  id: string;
  code: string;
  uses: number;
  maxUses: number;
  status: string;
  expiresAt: string | null;
}

export default function AccountPage() {
  const { appearance } = useAppearance();
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [referralsEnabled, setReferralsEnabled] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Email edit state
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [setupEmailInput, setSetupEmailInput] = useState('');
  const [setupEmailError, setSetupEmailError] = useState('');
  const [setupEmailLoading, setSetupEmailLoading] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [referrals, setReferrals] = useState<ReferralInvite[]>([]);
  const [referralLoading, setReferralLoading] = useState(false);

  useEffect(() => {
    fetchAccount();
    fetch('/api/settings/public').then(r => r.json()).then(d => {
      if (d.emailEnabled) setEmailEnabled(true);
      if (d.referralInvitesEnabled) setReferralsEnabled(true);
    }).catch(() => {});
  }, []);

  const fetchAccount = async () => {
    try {
      const res = await fetch('/api/account/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        fetchReferrals();
      } else {
        setShowLogin(true);
      }
    } catch {
      setShowLogin(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferrals = async () => {
    try {
      const res = await fetch('/api/account/referrals');
      if (!res.ok) return;
      const data = await res.json();
      setReferrals(Array.isArray(data) ? data : []);
    } catch {}
  };

  const handleCreateReferral = async () => {
    setReferralLoading(true);
    try {
      const res = await fetch('/api/account/referrals', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setReferrals((prev) => [data, ...prev]);
      } else {
        setReferralError(data.message || 'Failed to create referral invite');
      }
    } catch {
      setReferralError('Failed to create referral invite');
    } finally {
      setReferralLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      if (res.ok) {
        setShowLogin(false);
        setLoading(true);
        await fetchAccount();
      } else {
        const data = await res.json();
        setLoginError(data.message || 'Invalid credentials');
      }
    } catch {
      setLoginError('Something went wrong');
    } finally {
      setLoginLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        if (data.syncResults && data.syncResults.length > 0) {
          const synced = data.syncResults.filter((r: { synced: boolean }) => r.synced);
          const failed = data.syncResults.filter((r: { synced: boolean }) => !r.synced);
          if (failed.length === 0) {
            setPasswordSuccess(`Password updated and synced to ${synced.map((r: { serverName: string }) => r.serverName).join(', ')}.`);
          } else if (synced.length > 0) {
            setPasswordSuccess(`Password updated. Synced to ${synced.map((r: { serverName: string }) => r.serverName).join(', ')}. Failed: ${failed.map((r: { serverName: string }) => r.serverName).join(', ')} — contact your admin.`);
          } else {
            setPasswordSuccess('Local password updated. Server sync failed — contact your admin.');
          }
        } else if (data.serverType === 'jellyfin') {
          setPasswordSuccess(
            data.jellyfinSynced
              ? 'Password updated! Your Jellyfin password has been synced.'
              : 'Local password updated. Jellyfin password could not be synced — contact your admin.'
          );
        } else {
          setPasswordSuccess('Password updated successfully!');
        }
      } else {
        setPasswordError(data.message || 'Failed to change password');
      }
    } catch {
      setPasswordError('Something went wrong');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleEmailSave = async () => {
    setEmailError('');
    if (!emailInput || !emailInput.includes('@')) {
      setEmailError('Please enter a valid email');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await fetch('/api/account/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });

      const data = await res.json();
      if (res.ok) {
        setUser((prev) => prev ? { ...prev, email: data.email } : prev);
        setEditingEmail(false);
      } else {
        setEmailError(data.message || 'Failed to update email');
      }
    } catch {
      setEmailError('Something went wrong');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/account/logout', { method: 'POST' });
    setUser(null);
    setShowLogin(true);
  };

  const handleSetupEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupEmailError('');
    if (!setupEmailInput || !setupEmailInput.includes('@')) {
      setSetupEmailError('Please enter a valid email address');
      return;
    }

    setSetupEmailLoading(true);
    try {
      const res = await fetch('/api/account/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: setupEmailInput }),
      });

      const data = await res.json();
      if (res.ok) {
        setUser((prev) => prev ? { ...prev, email: data.email, emailRequired: false } : prev);
      } else {
        setSetupEmailError(data.message || 'Failed to set email');
      }
    } catch {
      setSetupEmailError('Something went wrong');
    } finally {
      setSetupEmailLoading(false);
    }
  };

  if (loading) return null;

  if (showLogin) {
    return (
      <div
        className={styles.container}
        data-flow-particles={appearance?.onboardingParticleStyle && appearance.onboardingParticleStyle !== 'none' ? 'on' : 'off'}
        data-flow-glass={appearance?.onboardingGlass ? 'on' : 'off'}
      >
        {appearance?.onboardingParticleStyle && appearance.onboardingParticleStyle !== 'none' ? (
          <FlowBackground
            visuals={{
              onboardingParticleStyle: appearance?.onboardingParticleStyle,
              onboardingParticleIntensity: appearance?.onboardingParticleIntensity,
              onboardingParticleCursor: appearance?.onboardingParticleCursor,
            }}
            accent={appearance?.accentColor || '#A78BFA'}
            noise={appearance?.enableNoise !== false}
          />
        ) : (
          <div className={styles.background} />
        )}
        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.logoIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h1 className={styles.title}>My Account</h1>
            <p className={styles.subtitle}>Sign in to manage your account</p>
          </div>

          <Card padding="lg">
            <form onSubmit={handleLogin} className={styles.form}>
              <Input
                label="Username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
              <Input
                label="Password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                error={loginError}
                autoComplete="current-password"
              />
              <Button type="submit" fullWidth loading={loginLoading}>
                Sign In
              </Button>
              <div className={styles.footer}>
                {emailEnabled && <Link href="/forgot-password">Forgot your password?</Link>}
              </div>
            </form>
          </Card>

          <div className={styles.footer}>
            <Link href="/">Back to home</Link>
          </div>
        </div>
      </div>
    );
  }

  if (user?.emailRequired) {
    return (
      <div
        className={styles.container}
        data-flow-particles={appearance?.onboardingParticleStyle && appearance.onboardingParticleStyle !== 'none' ? 'on' : 'off'}
        data-flow-glass={appearance?.onboardingGlass ? 'on' : 'off'}
      >
        {appearance?.onboardingParticleStyle && appearance.onboardingParticleStyle !== 'none' ? (
          <FlowBackground
            visuals={{
              onboardingParticleStyle: appearance?.onboardingParticleStyle,
              onboardingParticleIntensity: appearance?.onboardingParticleIntensity,
              onboardingParticleCursor: appearance?.onboardingParticleCursor,
            }}
            accent={appearance?.accentColor || '#A78BFA'}
            noise={appearance?.enableNoise !== false}
          />
        ) : (
          <div className={styles.background} />
        )}
        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.logoIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <h1 className={styles.title}>Set Up Your Email</h1>
            <p className={styles.subtitle}>
              Welcome, <strong>{user?.username}</strong>! Please add your email address to continue. This is needed for password resets and account notifications.
            </p>
          </div>

          <Card padding="lg">
            <form onSubmit={handleSetupEmail} className={styles.form}>
              <Input
                label="Email Address"
                type="email"
                value={setupEmailInput}
                onChange={(e) => setSetupEmailInput(e.target.value)}
                error={setupEmailError}
                placeholder="you@example.com"
                autoFocus
              />
              <Button type="submit" fullWidth loading={setupEmailLoading}>
                Continue
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.background} />
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1 className={styles.title}>My Account</h1>
          <p className={styles.subtitle}>
            Signed in as <strong>{user?.username}</strong>
          </p>
        </div>

        {/* Account Info */}
        <Card padding="lg">
          <div className={styles.sectionTitle}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Account Info
          </div>

          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Username</span>
            <span className={styles.infoValue}>{user?.username}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Email</span>
            {editingEmail ? (
              <div className={styles.emailEdit}>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className={styles.emailInput}
                  autoFocus
                />
                <button onClick={handleEmailSave} disabled={emailLoading} className={styles.emailSaveBtn}>
                  {emailLoading ? '...' : 'Save'}
                </button>
                <button onClick={() => { setEditingEmail(false); setEmailError(''); }} className={styles.emailCancelBtn}>
                  Cancel
                </button>
              </div>
            ) : (
              <span className={styles.infoValue}>
                {user?.email}
                <button
                  onClick={() => { setEditingEmail(true); setEmailInput(user?.email ?? ''); setEmailError(''); }}
                  className={styles.editBtn}
                  title="Edit email"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </span>
            )}
            {emailError && <span className={styles.emailError}>{emailError}</span>}
          </div>
          {user?.servers && user.servers.length > 0 ? (
            <>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{user.servers.length > 1 ? 'Servers' : 'Server'}</span>
                <span className={styles.infoValue} />
              </div>
              {user.servers.map((s) => (
                <div key={s.id} className={styles.serverRow}>
                  <div className={styles.serverRowMain}>
                    <span className={styles.serverName}>{s.name}</span>
                    <span className={`${styles.badge} ${s.type === 'jellyfin' ? styles.badgeJellyfin : styles.badgePlex}`}>
                      {s.type}
                    </span>
                    {s.disabled && (
                      <span className={styles.badgeDisabled}>Disabled</span>
                    )}
                  </div>
                  {s.libraries && s.libraries.length > 0 && (
                    <div className={styles.serverLibraries}>
                      {s.libraries.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : user?.server ? (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Server</span>
              <span className={styles.infoValue}>
                {user.server.name}{' '}
                <span className={`${styles.badge} ${user.server.type === 'jellyfin' ? styles.badgeJellyfin : styles.badgePlex}`}>
                  {user.server.type}
                </span>
              </span>
            </div>
          ) : null}
          {user?.accessUntil && (() => {
            const now = new Date();
            const until = new Date(user.accessUntil);
            const diffMs = until.getTime() - now.getTime();
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            const isExpired = diffDays <= 0;
            return (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Access</span>
                <span className={styles.infoValue}>
                  {isExpired ? (
                    <span className={styles.accessExpired}>Expired</span>
                  ) : (
                    <>
                      <span className={diffDays <= 7 ? styles.accessExpiring : ''}>
                        {diffDays} day{diffDays !== 1 ? 's' : ''} remaining
                      </span>
                      <span className={styles.accessDate}>
                        (until {until.toLocaleDateString()})
                      </span>
                    </>
                  )}
                </span>
              </div>
            );
          })()}
          {!user?.accessUntil && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Access</span>
              <span className={styles.infoValue}>
                <span className={styles.accessPermanent}>Permanent</span>
              </span>
            </div>
          )}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Member Since</span>
            <span className={styles.infoValue}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
            </span>
          </div>
        </Card>

        {/* Password Change */}
        <div className={styles.section}>
          <Card padding="lg">
            <div className={styles.sectionTitle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Change Password
            </div>

            {user?.server?.type === 'plex' && (
              <div className={styles.plexNote}>
                <p>
                  Plex passwords are managed through plex.tv and cannot be changed here.
                </p>
                <a
                  href="https://app.plex.tv/auth#?resetPassword"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.plexLink}
                >
                  Reset password on plex.tv
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            )}

            {user?.server?.type !== 'plex' && (
              <form onSubmit={handlePasswordChange} className={styles.form}>
                <Input
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <Input
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={passwordError}
                  autoComplete="new-password"
                />

                {passwordSuccess && (
                  <div className={styles.successMessage}>{passwordSuccess}</div>
                )}

                <Button type="submit" fullWidth loading={passwordLoading}>
                  Update Password
                </Button>
              </form>
            )}
          </Card>
        </div>

        {referralsEnabled && <div className={styles.section}>
          <Card padding="lg">
            <div className={styles.sectionTitle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Referral Invites
            </div>

            <Button onClick={handleCreateReferral} loading={referralLoading} fullWidth>
              Create Referral Invite
            </Button>

            {referrals.length > 0 && (
              <div className={styles.form}>
                {referrals.map((invite) => (
                  <div key={invite.id} className={styles.infoRow}>
                    <span className={styles.infoLabel}>{invite.code}</span>
                    <span className={styles.infoValue}>
                      {invite.uses}/{invite.maxUses === 0 ? 'inf' : invite.maxUses} {invite.expiresAt ? `- expires ${new Date(invite.expiresAt).toLocaleDateString()}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>}

        <div className={styles.footer}>
          <Link href="/">Back to home</Link>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
