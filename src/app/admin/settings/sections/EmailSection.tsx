'use client';

import { useState } from 'react';
import { Input, Button } from '@/components';
import { SectionProps, Settings } from './types';

interface EmailSectionProps extends SectionProps {
  setSmtpPassDirty: (dirty: boolean) => void;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setShowSaveBar: (show: boolean) => void;
}

export default function EmailSection({
  settings,
  set,
  styles,
  setSmtpPassDirty,
  setSettings,
  setShowSaveBar,
}: EmailSectionProps) {
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmail, setTestEmail] = useState('');

  const handleTestSmtp = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpUser: settings.smtpUser,
          smtpPass: settings.smtpPass || undefined,
          smtpFrom: settings.smtpFrom,
          recipientEmail: testEmail || undefined,
        }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
    } catch {
      setTestResult({ success: false, message: 'Failed to connect to test endpoint' });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Email</h2>
      <p className={styles.sectionDescription}>SMTP configuration for sending notifications</p>
      {!settings.emailEnabled && (
        <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#eab308', lineHeight: '1.5' }}>
          Email is disabled. The following features require SMTP to work: <strong>password reset</strong>, <strong>expiry notifications</strong>, <strong>email announcements</strong>, and <strong>welcome emails</strong>. Users will not be able to reset their own passwords without it — you can still reset passwords manually from the Users page.
        </div>
      )}
      <div className={styles.formGrid}>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={settings.emailEnabled}
            onChange={(e) => set('emailEnabled', e.target.checked)}
          />
          Enable SMTP notifications
        </label>
        <div className={styles.twoColGrid}>
          <Input
            label="SMTP Host"
            value={settings.smtpHost}
            onChange={(e) => set('smtpHost', e.target.value)}
          />
          <Input
            label="SMTP Port"
            type="number"
            value={String(settings.smtpPort ?? 587)}
            onChange={(e) => set('smtpPort', parseInt(e.target.value || '587', 10) || 587)}
          />
        </div>
        <div className={styles.twoColGrid}>
          <Input
            label="SMTP User"
            value={settings.smtpUser}
            onChange={(e) => set('smtpUser', e.target.value)}
          />
          <Input
            label={settings.hasSmtpPass && !settings.smtpPass ? 'SMTP Password (saved)' : 'SMTP Password'}
            type="password"
            value={settings.smtpPass}
            placeholder={settings.hasSmtpPass && !settings.smtpPass ? '••••••••' : ''}
            onChange={(e) => {
              setSettings(prev => ({ ...prev, smtpPass: e.target.value }));
              setSmtpPassDirty(true);
              setShowSaveBar(true);
            }}
          />
        </div>
        <Input
          label="SMTP From"
          value={settings.smtpFrom}
          onChange={(e) => set('smtpFrom', e.target.value)}
        />
        {settings.smtpHost && settings.smtpFrom && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Send test email to (optional)"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleTestSmtp}
              loading={testLoading}
              style={{ marginBottom: '2px' }}
            >
              {testEmail ? 'Send Test Email' : 'Test Connection'}
            </Button>
          </div>
        )}
        {testResult && (
          <div style={{
            background: testResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${testResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '13px',
            color: testResult.success ? '#22c55e' : '#ef4444',
          }}>
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
