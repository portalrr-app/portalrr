'use client';

import { Input } from '@/components';
import { SectionProps, Server } from './types';

interface InviteRequestsSectionProps extends SectionProps {
  servers: Server[];
}

export default function InviteRequestsSection({ settings, set, styles, servers }: InviteRequestsSectionProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Invite Requests</h2>
      <p className={styles.sectionDescription}>Allow users to request access — you approve or deny from the admin panel</p>
      <div className={styles.formGrid}>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={settings.inviteRequestsEnabled}
            onChange={(e) => set('inviteRequestsEnabled', e.target.checked)}
          />
          Enable invite requests
        </label>
        <Input
          label="Request Page Message"
          value={settings.inviteRequestMessage}
          onChange={(e) => set('inviteRequestMessage', e.target.value)}
        />
        {servers.length > 0 && (
          <div>
            <label className={styles.label}>Default Server for Approved Requests</label>
            <select
              className={styles.select}
              value={settings.inviteRequestServerId}
              onChange={(e) => set('inviteRequestServerId', e.target.value)}
            >
              <option value="">Select a server...</option>
              {servers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
