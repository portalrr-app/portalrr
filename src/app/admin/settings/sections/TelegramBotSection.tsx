'use client';

import { Button, Input } from '@/components';
import { SectionProps, Settings } from './types';

interface TelegramBotSectionProps extends SectionProps {
  telegramBotTokenDirty: boolean;
  setTelegramBotTokenDirty: (dirty: boolean) => void;
  telegramTestStatus: 'idle' | 'testing' | 'success' | 'error';
  setTelegramTestStatus: (status: 'idle' | 'testing' | 'success' | 'error') => void;
  telegramBotName: string;
  setTelegramBotName: (name: string) => void;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setShowSaveBar: (show: boolean) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function TelegramBotSection({
  settings,
  set,
  styles,
  telegramBotTokenDirty: _telegramBotTokenDirty,
  setTelegramBotTokenDirty,
  telegramTestStatus,
  setTelegramTestStatus,
  telegramBotName,
  setTelegramBotName,
  setSettings,
  setShowSaveBar,
  onSuccess,
  onError,
}: TelegramBotSectionProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Telegram Bot</h2>
      <p className={styles.sectionDescription}>Send notifications to a Telegram group or channel</p>
      <div className={styles.formGrid}>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={settings.telegramBotEnabled}
            onChange={(e) => set('telegramBotEnabled', e.target.checked)}
          />
          Enable Telegram bot notifications
        </label>
        <Input
          label="Bot Token"
          type="password"
          placeholder={settings.hasTelegramBotToken && !settings.telegramBotToken ? 'Stored token' : 'e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'}
          value={settings.telegramBotToken}
          onChange={(e) => {
            setSettings(prev => ({ ...prev, telegramBotToken: e.target.value }));
            setTelegramBotTokenDirty(true);
            setShowSaveBar(true);
          }}
          hint="Create a bot via @BotFather on Telegram to get a token"
        />
        <Input
          label="Chat ID"
          placeholder="e.g. -1001234567890"
          value={settings.telegramChatId}
          onChange={(e) => set('telegramChatId', e.target.value)}
          hint="Group/channel ID where notifications are sent. Add the bot to the group, then use @userinfobot or the Telegram API to find the chat ID."
        />
        <div>
          <Button
            size="sm"
            variant="secondary"
            loading={telegramTestStatus === 'testing'}
            onClick={async () => {
              setTelegramTestStatus('testing');
              try {
                const res = await fetch('/api/admin/telegram/test', { method: 'POST' });
                const data = await res.json();
                if (res.ok && data.success) {
                  setTelegramTestStatus('success');
                  setTelegramBotName(data.botName || data.botUsername || 'Unknown');
                  onSuccess(`Connected to @${data.botUsername || 'bot'}${data.messageSent ? ' — test message sent!' : ''}`);
                } else {
                  setTelegramTestStatus('error');
                  onError(data.message || 'Connection failed');
                }
              } catch {
                setTelegramTestStatus('error');
                onError('Failed to test Telegram bot');
              }
            }}
          >
            Test Connection
          </Button>
          {telegramTestStatus === 'success' && telegramBotName && (
            <span style={{ marginLeft: 8, color: 'var(--success)', fontSize: '0.85rem' }}>
              Bot: {telegramBotName}
            </span>
          )}
          {telegramTestStatus === 'error' && (
            <span style={{ marginLeft: 8, color: 'var(--error)', fontSize: '0.85rem' }}>
              Connection failed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
