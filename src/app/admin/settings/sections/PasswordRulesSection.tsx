'use client';

import { Input } from '@/components';
import { SectionProps } from './types';

export default function PasswordRulesSection({ settings, set, styles }: SectionProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Password Rules</h2>
      <p className={styles.sectionDescription}>Customizable password requirements for new user registrations</p>
      <div className={styles.formGrid}>
        <Input
          label="Minimum Length"
          type="number"
          value={String(settings.passwordMinLength)}
          onChange={(e) => set('passwordMinLength', parseInt(e.target.value || '8', 10) || 8)}
        />
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={settings.passwordRequireUppercase}
            onChange={(e) => set('passwordRequireUppercase', e.target.checked)}
          />
          Require uppercase letter
        </label>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={settings.passwordRequireNumber}
            onChange={(e) => set('passwordRequireNumber', e.target.checked)}
          />
          Require number
        </label>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={settings.passwordRequireSpecial}
            onChange={(e) => set('passwordRequireSpecial', e.target.checked)}
          />
          Require special character
        </label>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={settings.welcomeEmailEnabled}
            onChange={(e) => set('welcomeEmailEnabled', e.target.checked)}
          />
          Send welcome email on registration
        </label>
      </div>
    </div>
  );
}
