'use client';

import { useEffect, useMemo } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const timestamp = useMemo(() => new Date().toISOString(), []);
  const errorRef = error.digest || timestamp.slice(0, 19).replace(/[T:-]/g, '');

  useEffect(() => {
    console.error('[Portalrr] Unhandled error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp,
      page: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    });
  }, [error, timestamp]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base, #0C0B0E)',
      color: 'var(--text-primary, #F0EFF4)',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
      padding: 24,
    }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-lg, 14px)',
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
          fontFamily: 'var(--font-display, var(--font-body, system-ui))',
          marginBottom: 8,
        }}>
          Something went wrong
        </h1>
        <p style={{
          color: 'var(--text-secondary, #9D9BA6)',
          fontSize: 14,
          lineHeight: 1.6,
          marginBottom: 16,
        }}>
          An unexpected error occurred. Please try again or contact the server admin if the problem persists.
        </p>
        <div style={{
          background: 'var(--bg-surface, #15141A)',
          border: '1px solid var(--border, #2A2930)',
          borderRadius: 'var(--radius-md, 10px)',
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: 12,
          color: 'var(--text-tertiary, #65636E)',
          fontFamily: 'monospace',
          textAlign: 'left',
        }}>
          <div>Error reference: <span style={{ color: 'var(--text-secondary, #9D9BA6)' }}>{errorRef}</span></div>
          <div>Time: <span style={{ color: 'var(--text-secondary, #9D9BA6)' }}>{new Date(timestamp).toLocaleString()}</span></div>
          {error.message && !error.message.includes('internal') && (
            <div style={{ marginTop: 4 }}>
              Detail: <span style={{ color: 'var(--text-secondary, #9D9BA6)' }}>{error.message.slice(0, 120)}</span>
            </div>
          )}
        </div>
        <button
          onClick={reset}
          style={{
            padding: '10px 24px',
            borderRadius: 'var(--radius-md, 10px)',
            background: 'var(--accent, #A78BFA)',
            color: 'var(--accent-contrast, #ffffff)',
            border: 'none',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
