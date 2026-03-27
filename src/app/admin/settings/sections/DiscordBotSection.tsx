'use client';

import { Button, Input } from '@/components';
import { SectionProps, Settings, DiscordRole, DiscordChannel } from './types';

interface DiscordBotSectionProps extends SectionProps {
  discordBotTokenDirty: boolean;
  setDiscordBotTokenDirty: (dirty: boolean) => void;
  discordTestStatus: 'idle' | 'testing' | 'success' | 'error';
  discordBotName: string;
  discordRoles: DiscordRole[];
  discordChannels: DiscordChannel[];
  onTestDiscordBot: () => void;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setShowSaveBar: (show: boolean) => void;
}

export default function DiscordBotSection({
  settings,
  set,
  styles,
  discordBotTokenDirty,
  setDiscordBotTokenDirty,
  discordTestStatus,
  discordBotName,
  discordRoles,
  discordChannels,
  onTestDiscordBot,
  setSettings,
  setShowSaveBar,
}: DiscordBotSectionProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Discord Bot</h2>
      <p className={styles.sectionDescription}>Send notifications and assign roles via a Discord bot</p>
      <div className={styles.formGrid}>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={settings.discordBotEnabled}
            onChange={(e) => set('discordBotEnabled', e.target.checked)}
          />
          Enable Discord bot integration
        </label>
        <Input
          label="Bot Token"
          type="password"
          value={settings.discordBotToken}
          placeholder={settings.hasDiscordBotToken && !settings.discordBotToken ? 'Stored token' : 'Paste your bot token'}
          onChange={(e) => {
            setSettings(prev => ({ ...prev, discordBotToken: e.target.value }));
            setDiscordBotTokenDirty(true);
            setShowSaveBar(true);
          }}
        />
        <div className={styles.twoColGrid}>
          <Input
            label="Guild (Server) ID"
            value={settings.discordGuildId}
            placeholder="Right-click server > Copy Server ID"
            onChange={(e) => set('discordGuildId', e.target.value)}
          />
          <div className={styles.selfEnd}>
            <Button
              size="sm"
              onClick={onTestDiscordBot}
              loading={discordTestStatus === 'testing'}
              disabled={!settings.discordGuildId || (!settings.hasDiscordBotToken && !discordBotTokenDirty)}
            >
              Test Connection
            </Button>
          </div>
        </div>
        {discordTestStatus === 'success' && discordBotName && (
          <div className={`${styles.testResult} ${styles.success}`}>
            Connected as {discordBotName}
          </div>
        )}
        {discordTestStatus === 'error' && (
          <div className={`${styles.testResult} ${styles.error}`}>
            Connection failed
          </div>
        )}
        {discordChannels.length > 0 && (
          <div>
            <label className={styles.label}>Notification Channel</label>
            <select
              className={styles.select}
              value={settings.discordNotifyChannelId}
              onChange={(e) => set('discordNotifyChannelId', e.target.value)}
            >
              <option value="">None (no channel notifications)</option>
              {discordChannels.map(c => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          </div>
        )}
        {discordRoles.length > 0 && (
          <div>
            <label className={styles.label}>Registration Role</label>
            <select
              className={styles.select}
              value={settings.discordRoleId}
              onChange={(e) => set('discordRoleId', e.target.value)}
            >
              <option value="">None (no role assignment)</option>
              {discordRoles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
