'use client';

import { Input } from '@/components';
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
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Email</h2>
      <p className={styles.sectionDescription}>SMTP configuration for sending notifications</p>
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
            label="SMTP Password"
            type="password"
            value={settings.smtpPass}
            placeholder={settings.hasSmtpPass && !settings.smtpPass ? 'Stored password' : ''}
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
      </div>
    </div>
  );
}
