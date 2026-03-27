'use client';

import { SectionProps } from './types';

export default function SecuritySection({ settings, set, styles }: SectionProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Security</h2>
      <p className={styles.sectionDescription}>Authentication settings for your server</p>

      <label className={styles.toggleLabel}>
        <input
          type="checkbox"
          checked={settings.mediaServerAuth}
          onChange={(e) => set('mediaServerAuth', e.target.checked)}
        />
        Media Server Admin Login
      </label>
      <p className={styles.sectionDescription}>Allow Jellyfin admins and Plex server owners to log in as Portalrr admins using their media server credentials.</p>
    </div>
  );
}
