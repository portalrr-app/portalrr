'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Card } from '@/components';
import styles from './page.module.css';

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // Step 1: request reset
  const [email, setEmail] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState('');
  // Step 2: confirm reset
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError('');
    setRequestLoading(true);

    try {
      const res = await fetch('/api/account/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setRequestSent(true);
      } else {
        const data = await res.json();
        setRequestError(data.message || 'Something went wrong');
      }
    } catch {
      setRequestError('Something went wrong');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }

    setResetLoading(true);

    try {
      const res = await fetch('/api/account/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setResetSuccess(true);
      } else {
        setResetError(data.message || 'Failed to reset password');
      }
    } catch {
      setResetError('Something went wrong');
    } finally {
      setResetLoading(false);
    }
  };

  // Step 2: token present — show new password form
  if (token) {
    return (
      <div className={styles.container}>
        <div className={styles.background} />
        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.logoIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1 className={styles.title}>Reset Password</h1>
            <p className={styles.subtitle}>Enter your new password below</p>
          </div>

          <Card padding="lg">
            {resetSuccess ? (
              <div className={styles.successMessage}>
                Your password has been reset successfully. You can now sign in with your new password.
              </div>
            ) : (
              <form onSubmit={handleConfirmReset} className={styles.form}>
                <Input
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {resetError && (
                  <div className={styles.errorMessage}>{resetError}</div>
                )}
                <Button type="submit" fullWidth loading={resetLoading}>
                  Reset Password
                </Button>
              </form>
            )}
          </Card>

          <div className={styles.footer}>
            <Link href="/account">Back to sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: no token — show email form
  return (
    <div className={styles.container}>
      <div className={styles.background} />
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className={styles.title}>Forgot Password</h1>
          <p className={styles.subtitle}>
            {requestSent
              ? 'Check your email for a reset link'
              : 'Enter your email to receive a reset link'}
          </p>
        </div>

        <Card padding="lg">
          {requestSent ? (
            <div className={styles.successMessage}>
              If an account with that email exists, a password reset link has been sent. Please check your inbox.
            </div>
          ) : (
            <form onSubmit={handleRequestReset} className={styles.form}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
              {requestError && (
                <div className={styles.errorMessage}>{requestError}</div>
              )}
              <Button type="submit" fullWidth loading={requestLoading}>
                Send Reset Link
              </Button>
            </form>
          )}
        </Card>

        <div className={styles.footer}>
          <Link href="/account">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
