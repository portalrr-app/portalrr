'use client';

import { Input } from '@/components';
import { SectionProps, Settings } from './types';

export default function UserLifecycleSection({ settings, set, styles }: SectionProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>User Lifecycle</h2>
      <p className={styles.sectionDescription}>What happens when user access expires</p>
      <div className={styles.formGrid}>
        <div className={styles.twoColGrid}>
          <div>
            <label className={styles.label}>Expiry Policy</label>
            <select
              className={styles.select}
              value={settings.expiryPolicy}
              onChange={(e) => set('expiryPolicy', e.target.value as Settings['expiryPolicy'])}
            >
              <option value="delete">Delete immediately</option>
              <option value="disable">Disable only</option>
              <option value="disable_then_delete">Disable, then delete later</option>
            </select>
          </div>
          <Input
            label="Delete After Disabled (days)"
            type="number"
            value={String(settings.expiryDeleteAfterDays)}
            onChange={(e) => set('expiryDeleteAfterDays', parseInt(e.target.value || '0', 10) || 0)}
          />
        </div>
        <div className={styles.twoColGrid}>
          <Input
            label="Notify Before Expiry (days)"
            type="number"
            value={String(settings.notifyBeforeExpiryDays)}
            onChange={(e) => set('notifyBeforeExpiryDays', parseInt(e.target.value || '0', 10) || 0)}
          />
          <label className={`${styles.toggleLabel} ${styles.selfEnd}`}>
            <input
              type="checkbox"
              checked={settings.notifyOnExpiry}
              onChange={(e) => set('notifyOnExpiry', e.target.checked)}
            />
            Notify when access expires
          </label>
        </div>
      </div>
    </div>
  );
}
