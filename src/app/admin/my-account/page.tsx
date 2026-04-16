'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@/components';
import { useToast } from '@/hooks/useToast';
import styles from './page.module.css';

interface AdminProfile {
  id: string;
  username: string;
  source: string;
  totpEnabled: boolean;
  createdAt: string;
}

export default function MyAccountPage() {
  const { success, error: toastError } = useToast();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // 2FA
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpLoading, setTotpLoading] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [otpauthUri, setOtpauthUri] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/admin/me');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setTotpEnabled(data.totpEnabled || false);
      }
    } catch {
      toastError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

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
      const res = await fetch('/api/admin/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        success('Password updated');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(data.message || 'Failed to update password');
      }
    } catch {
      setPasswordError('Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSetup2FA = async () => {
    setTotpLoading(true);
    try {
      const res = await fetch('/api/admin/2fa', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setOtpauthUri(data.otpauthUri);
        setTotpSecret(data.secret);
        setShowSetupModal(true);
      } else {
        const data = await res.json().catch(() => ({}));
        toastError(data.message || 'Failed to start 2FA setup');
      }
    } catch {
      toastError('Failed to start 2FA setup');
    } finally {
      setTotpLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (verifyCode.length !== 6) {
      toastError('Please enter a 6-digit code');
      return;
    }
    setTotpLoading(true);
    try {
      const res = await fetch('/api/admin/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode, secret: totpSecret }),
      });
      if (res.ok) {
        success('2FA enabled successfully');
        setTotpEnabled(true);
        setShowSetupModal(false);
        setVerifyCode('');
      } else {
        const data = await res.json();
        toastError(data.message || 'Invalid code');
      }
    } catch {
      toastError('Failed to verify 2FA');
    } finally {
      setTotpLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('Disable 2FA? This makes your account less secure.')) return;
    setTotpLoading(true);
    try {
      const res = await fetch('/api/admin/2fa', { method: 'DELETE' });
      if (res.ok) {
        success('2FA disabled');
        setTotpEnabled(false);
      } else {
        toastError('Failed to disable 2FA');
      }
    } catch {
      toastError('Failed to disable 2FA');
    } finally {
      setTotpLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>My Account</h1>
        <p className={styles.subtitle}>Manage your admin account settings</p>
      </div>

      <div className={styles.sections}>
        {/* Profile Info */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Profile</h2>
          {profile && (
            <div className={styles.profileCard}>
              <div className={styles.profileRow}>
                <span className={styles.profileLabel}>Username</span>
                <span className={styles.profileValue}>{profile.username}</span>
              </div>
              <div className={styles.profileRow}>
                <span className={styles.profileLabel}>Auth Source</span>
                <span className={styles.profileValue}>{profile.source}</span>
              </div>
              <div className={styles.profileRow}>
                <span className={styles.profileLabel}>Created</span>
                <span className={styles.profileValue}>
                  {new Date(profile.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Change Password */}
        {profile?.source === 'local' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Change Password</h2>
            <form onSubmit={handleChangePassword} className={styles.passwordForm}>
              <Input
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={passwordError}
              />
              <Button
                type="submit"
                loading={passwordLoading}
                disabled={!currentPassword || !newPassword || !confirmPassword}
              >
                Update Password
              </Button>
            </form>
          </section>
        )}

        {/* Two-Factor Authentication */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Two-Factor Authentication</h2>
          <div className={styles.twoFactorCard}>
            <div className={styles.twoFactorIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className={styles.twoFactorInfo}>
              <div className={styles.twoFactorStatus}>
                {totpEnabled ? (
                  <span className={styles.statusEnabled}>Enabled</span>
                ) : (
                  <span className={styles.statusDisabled}>Disabled</span>
                )}
              </div>
              <div className={styles.twoFactorDesc}>
                {totpEnabled
                  ? 'Your account is protected with an authenticator app.'
                  : 'Add an extra layer of security by requiring a code from your authenticator app at login.'}
              </div>
            </div>
            <div className={styles.twoFactorAction}>
              {totpEnabled ? (
                <Button size="sm" variant="danger" onClick={handleDisable2FA} loading={totpLoading}>
                  Disable
                </Button>
              ) : (
                <Button size="sm" onClick={handleSetup2FA} loading={totpLoading}>
                  Enable 2FA
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Active Sessions — future feature placeholder */}
      </div>

      {/* 2FA Setup Modal */}
      <Modal
        isOpen={showSetupModal}
        onClose={() => { setShowSetupModal(false); setVerifyCode(''); }}
        title="Setup Two-Factor Authentication"
        description="Scan this QR code with your authenticator app"
        size="md"
      >
        <div className={styles.setupModal}>
          <div className={styles.secretContainer}>
            <p className={styles.secretLabel}>Enter this key in your authenticator app:</p>
            <code className={styles.secretKey}>{totpSecret}</code>
          </div>
          {otpauthUri && (
            <div className={styles.secretContainer}>
              <p className={styles.secretLabel}>Or copy this URI into your app:</p>
              <code className={styles.secretKey}>{otpauthUri}</code>
            </div>
          )}
          <div className={styles.verifySection}>
            <p className={styles.verifyLabel}>Enter the 6-digit code from your app:</p>
            <input
              type="text"
              className={styles.verifyInput}
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              maxLength={6}
              autoFocus
            />
          </div>
          <div className={styles.modalActions}>
            <Button variant="secondary" fullWidth onClick={() => { setShowSetupModal(false); setVerifyCode(''); }}>
              Cancel
            </Button>
            <Button fullWidth onClick={handleVerify2FA} loading={totpLoading} disabled={verifyCode.length !== 6}>
              Verify & Enable
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
