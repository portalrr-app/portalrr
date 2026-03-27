'use client';

import { Input } from '@/components';
import { SectionProps } from './types';

interface GeneralSectionProps extends SectionProps {
  expiryInput: string;
  setExpiryInput: (value: string) => void;
  maxInvitesInput: string;
  setMaxInvitesInput: (value: string) => void;
}

export default function GeneralSection({
  settings,
  set,
  styles,
  expiryInput,
  setExpiryInput,
  maxInvitesInput,
  setMaxInvitesInput,
}: GeneralSectionProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>General</h2>
      <p className={styles.sectionDescription}>Basic settings for your invite system</p>
      <div className={styles.formGrid}>
        <Input
          label="Server Name"
          value={settings.serverName}
          onChange={(e) => set('serverName', e.target.value)}
          hint="This name is shown to users on the invite page"
        />
        <div className={styles.twoColGrid}>
          <Input
            label="Default Invite Expiry (days)"
            type="text"
            inputMode="numeric"
            value={expiryInput}
            onChange={(e) => setExpiryInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => {
              const val = parseInt(expiryInput) || 7;
              setExpiryInput(val.toString());
              set('inviteExpiryDays', val);
            }}
          />
          <Input
            label="Max Active Invites"
            type="text"
            inputMode="numeric"
            value={maxInvitesInput}
            onChange={(e) => setMaxInvitesInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => {
              const val = parseInt(maxInvitesInput) || 100;
              setMaxInvitesInput(val.toString());
              set('maxInvites', val);
            }}
          />
        </div>
      </div>
    </div>
  );
}
