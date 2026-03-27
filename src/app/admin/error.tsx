'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const timestamp = useMemo(() => new Date().toISOString(), []);
  const errorRef = error.digest || timestamp.slice(0, 19).replace(/[T:-]/g, '');

  useEffect(() => {
    console.error('[Portalrr:Admin] Error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp,
      page: pathname,
    });
  }, [error, timestamp, pathname]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-body)',
      padding: 24,
    }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-lg)',
          background: 'rgba(248, 113, 113, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 style={{
          fontSize: 22,
          fontWeight: 600,
          fontFamily: 'var(--font-display)',
          marginBottom: 8,
        }}>
          Something went wrong
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: 14,
          lineHeight: 1.6,
          marginBottom: 16,
        }}>
          An error occurred in the admin panel. You can try again or go back to the dashboard.
        </p>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: 12,
          color: 'var(--text-tertiary)',
          fontFamily: 'monospace',
          textAlign: 'left',
        }}>
          <div>Error reference: <span style={{ color: 'var(--text-secondary)' }}>{errorRef}</span></div>
          <div>Time: <span style={{ color: 'var(--text-secondary)' }}>{new Date(timestamp).toLocaleString()}</span></div>
          <div>Page: <span style={{ color: 'var(--text-secondary)' }}>{pathname}</span></div>
          {error.message && !error.message.includes('internal') && (
            <div style={{ marginTop: 4 }}>
              Detail: <span style={{ color: 'var(--text-secondary)' }}>{error.message.slice(0, 120)}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              border: 'none',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/admin')}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
