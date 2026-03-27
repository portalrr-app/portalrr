'use client';

import { Input } from '@/components';
import { SectionProps } from './types';

export default function ReferralsSection({ settings, set, styles }: SectionProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Referrals</h2>
      <p className={styles.sectionDescription}>Let existing users invite others through referral links</p>
      <div className={styles.formGrid}>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={settings.referralInvitesEnabled}
            onChange={(e) => set('referralInvitesEnabled', e.target.checked)}
          />
          Enable referral invites in My Account
        </label>
        <div className={styles.twoColGrid}>
          <Input
            label="Referral Max Uses"
            type="number"
            value={String(settings.referralMaxUses)}
            onChange={(e) => set('referralMaxUses', parseInt(e.target.value || '1', 10) || 1)}
          />
          <Input
            label="Referral Expiry (days)"
            type="number"
            value={String(settings.referralExpiresInDays)}
            onChange={(e) => set('referralExpiresInDays', parseInt(e.target.value || '0', 10) || 0)}
          />
        </div>
        <div className={styles.twoColGrid}>
          <Input
            label="Referral Access Duration (days)"
            type="number"
            value={String(settings.referralAccessDurationDays)}
            onChange={(e) => set('referralAccessDurationDays', parseInt(e.target.value || '0', 10) || 0)}
          />
          <label className={`${styles.toggleLabel} ${styles.selfEnd}`}>
            <input
              type="checkbox"
              checked={settings.referralAutoRemove}
              onChange={(e) => set('referralAutoRemove', e.target.checked)}
            />
            Auto-remove on expiry
          </label>
        </div>
      </div>
    </div>
  );
}
