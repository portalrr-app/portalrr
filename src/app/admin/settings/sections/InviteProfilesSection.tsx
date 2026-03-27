'use client';

import { SectionProps } from './types';

export default function InviteProfilesSection({ settings, set, styles }: SectionProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Invite Profiles</h2>
      <p className={styles.sectionDescription}>Predefined access profiles for bulk invite creation</p>
      <div className={styles.formGrid}>
        <div className={styles.spanFull}>
          <label className={styles.label}>Invite Profiles (JSON)</label>
          <textarea
            className={styles.textarea}
            value={settings.inviteProfiles}
            onChange={(e) => set('inviteProfiles', e.target.value)}
            placeholder='[{"name":"Family","accessDurationDays":0,"autoRemove":false,"libraries":[],"allLibraries":true,"enableLiveTv":true}]'
          />
        </div>
      </div>
    </div>
  );
}
