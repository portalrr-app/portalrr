'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Steps } from '@/components';
import styles from './page.module.css';

export default function AdminSetup() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [checking, setChecking] = useState(true);

  // Step 1: Account
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 2: Server
  const [serverName, setServerName] = useState('');
  const [serverType, setServerType] = useState<'jellyfin' | 'plex'>('jellyfin');
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [plexToken, setPlexToken] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [serverError, setServerError] = useState('');
  const [serverLoading, setServerLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [serverSaved, setServerSaved] = useState(false);
  const [savedServerName, setSavedServerName] = useState('');

  useEffect(() => {
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

    fetch('/api/settings/public')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.accentColor) applyColor(data.accentColor);
      })
      .catch(() => {});

    fetch('/api/admin/setup')
      .then((res) => res.json())
      .then((data) => {
        if (!data.setupRequired) {
          router.replace('/admin/login');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        setStep(2);
      } else {
        const data = await res.json();
        setError(data.message || 'Setup failed');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleAddServer = async () => {
    setServerError('');

    if (!serverName.trim()) { setServerError('Server name is required'); return; }
    if (!serverUrl.trim()) { setServerError('Server URL is required'); return; }
    if (serverType === 'jellyfin' && !apiKey.trim()) { setServerError('API key is required'); return; }
    if (serverType === 'plex' && !plexToken.trim()) { setServerError('Plex token is required'); return; }

    setServerLoading(true);
    setTestStatus('idle');

    try {
      const createRes = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: serverName,
          type: serverType,
          url: serverUrl,
          ...(serverType === 'jellyfin'
            ? { apiKey, adminUsername: adminUsername || undefined, adminPassword: adminPassword || undefined }
            : { token: plexToken }),
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        setServerError(data.message || 'Failed to add server');
        setServerLoading(false);
        return;
      }

      const server = await createRes.json();

      setTestStatus('testing');
      const testRes = await fetch('/api/server/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: server.id }),
      });

      if (testRes.ok) {
        setTestStatus('success');
        setTestMessage('Connection successful!');
        setSavedServerName(serverName);
        setServerSaved(true);
        setTimeout(() => setStep(3), 1000);
      } else {
        const data = await testRes.json();
        setTestStatus('error');
        setTestMessage(data.message || 'Connection failed — check your settings');
        setSavedServerName(serverName);
        setServerSaved(true);
      }
    } catch {
      setServerError('Failed to add server');
    } finally {
      setServerLoading(false);
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

        <div className={styles.stepsWrapper}>
          <Steps currentStep={step} totalSteps={3} labels={['Account', 'Server', 'Done']} />
        </div>

        {step === 1 && (
          <div className={styles.card}>
            <h1 className={styles.cardTitle}>Create Admin Account</h1>
            <p className={styles.cardSubtitle}>Set up your administrator credentials to get started</p>
            <form onSubmit={handleCreateAccount} className={styles.form}>
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                hint="At least 3 characters"
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                hint="At least 8 characters"
              />
              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={error}
                autoComplete="new-password"
              />
              <Button type="submit" fullWidth loading={loading}>
                Continue
              </Button>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className={styles.card}>
            <h1 className={styles.cardTitle}>Connect Media Server</h1>
            <p className={styles.cardSubtitle}>Link your Jellyfin or Plex server to manage invites</p>

            <div className={styles.form}>
              <Input
                label="Server Name"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="My Media Server"
              />

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Server Type
                </label>
                <div className={styles.serverTypes}>
                  <button
                    type="button"
                    className={`${styles.serverType} ${serverType === 'jellyfin' ? styles.active : ''}`}
                    onClick={() => setServerType('jellyfin')}
                  >
                    Jellyfin
                  </button>
                  <button
                    type="button"
                    className={`${styles.serverType} ${serverType === 'plex' ? styles.active : ''}`}
                    onClick={() => setServerType('plex')}
                  >
                    Plex
                  </button>
                </div>
              </div>

              <Input
                label="Server URL"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder={serverType === 'jellyfin' ? 'http://localhost:8096' : 'http://localhost:32400'}
              />

              {serverType === 'jellyfin' ? (
                <div className={styles.fieldGroup}>
                  <Input
                    label="API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Your Jellyfin API key"
                  />
                  <p className={styles.fieldHint}>Found in Jellyfin Dashboard → API Keys</p>
                  <Input
                    label="Admin Username"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="Optional — for password operations"
                  />
                  <Input
                    label="Admin Password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              ) : (
                <div className={styles.fieldGroup}>
                  <Input
                    label="Plex Token"
                    value={plexToken}
                    onChange={(e) => setPlexToken(e.target.value)}
                    placeholder="Your Plex authentication token"
                  />
                  <p className={styles.fieldHint}>Found at plex.tv/claim or in Plex app XML</p>
                </div>
              )}

              {serverError && (
                <p style={{ fontSize: 13, color: 'var(--error)' }}>{serverError}</p>
              )}

              {testStatus === 'testing' && (
                <p className={styles.testStatus}>Testing connection...</p>
              )}
              {testStatus === 'success' && (
                <p className={`${styles.testStatus} ${styles.testSuccess}`}>{testMessage}</p>
              )}
              {testStatus === 'error' && (
                <div>
                  <p className={`${styles.testStatus} ${styles.testError}`}>{testMessage}</p>
                  <p className={styles.fieldHint}>Server saved — you can fix the connection later in Settings.</p>
                </div>
              )}

              <div className={styles.actions}>
                {serverSaved && testStatus === 'error' ? (
                  <Button fullWidth onClick={() => setStep(3)}>
                    Continue Anyway
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    onClick={handleAddServer}
                    loading={serverLoading}
                    disabled={testStatus === 'testing'}
                  >
                    {testStatus === 'testing' ? 'Testing...' : 'Add & Test Connection'}
                  </Button>
                )}
              </div>
              <button type="button" className={styles.skipLink} onClick={() => setStep(3)}>
                Skip for now
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={styles.card} style={{ textAlign: 'center' }}>
            <div className={styles.doneIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className={styles.cardTitle}>You&apos;re All Set</h1>
            <p className={styles.cardSubtitle}>Portalrr is ready to use</p>

            <div className={styles.summaryList}>
              <div className={styles.summaryItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Admin account created</span>
              </div>
              <div className={styles.summaryItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {serverSaved ? (
                    <polyline points="20 6 9 17 4 12" />
                  ) : (
                    <>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </>
                  )}
                </svg>
                <span>{serverSaved ? `${savedServerName} connected` : 'No server connected yet'}</span>
              </div>
            </div>

            <Button fullWidth onClick={() => router.push('/admin')}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
