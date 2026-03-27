import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-body)',
      padding: 24,
    }}>
      <div style={{
        maxWidth: 440,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 64,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--accent)',
          lineHeight: 1,
          marginBottom: 8,
        }}>
          404
        </div>
        <h1 style={{
          fontSize: 22,
          fontWeight: 600,
          fontFamily: 'var(--font-display)',
          marginBottom: 8,
        }}>
          Page not found
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: 14,
          lineHeight: 1.6,
          marginBottom: 24,
        }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent)',
            color: 'var(--accent-contrast)',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
