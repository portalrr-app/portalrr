'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components';
import { useToast } from '@/hooks/useToast';
import styles from './page.module.css';
import {
  GeneralSection,
  ServersSection,
  IntegrationsSection,
  InviteProfilesSection,
  ReferralsSection,
  UserLifecycleSection,
  EmailSection,
  DiscordBotSection,
  TelegramBotSection,
  PasswordRulesSection,
  InviteRequestsSection,
  SecuritySection,
  BackupRestoreSection,
} from './sections';
import type { Settings, Server, DiscordRole, DiscordChannel } from './sections';

const BACKUP_SECTIONS = [
  { key: 'settings', label: 'Settings' },
  { key: 'invites', label: 'Invites' },
  { key: 'users', label: 'Users' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'emailTemplates', label: 'Email Templates' },
  { key: 'announcements', label: 'Announcements' },
] as const;

export default function SettingsPage() {
  const { success, error } = useToast();
  const [settings, setSettings] = useState<Settings>({
    serverName: 'Media Server',
    accentColor: '#A78BFA',
    inviteExpiryDays: 7,
    maxInvites: 100,
    inviteProfiles: '[]',
    preRegisterTitle: 'Before You Start',
    preRegisterSubtitle: "Review the server rules and expectations before creating your account.",
    preRegisterChecklist: '[]',
    requireInviteAcceptance: false,
    captchaEnabled: false,
    customCss: '',
    emailEnabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    notifyBeforeExpiryDays: 3,
    notifyOnExpiry: false,
    expiryPolicy: 'delete',
    expiryDeleteAfterDays: 7,
    referralInvitesEnabled: false,
    referralMaxUses: 1,
    referralExpiresInDays: 7,
    referralAccessDurationDays: 0,
    referralAutoRemove: false,
    jellyseerrUrl: '',
    jellyseerrApiKey: '',
    mediaServerAuth: false,
    passwordMinLength: 8,
    passwordRequireUppercase: false,
    passwordRequireNumber: false,
    passwordRequireSpecial: false,
    welcomeEmailEnabled: false,
    inviteRequestsEnabled: false,
    inviteRequestMessage: 'Request access to join our media server',
    inviteRequestServerId: '',
    // Discord bot
    discordBotEnabled: false,
    discordBotToken: '',
    discordGuildId: '',
    discordNotifyChannelId: '',
    discordRoleId: '',
    // Telegram bot
    telegramBotEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
  });
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveBar, setShowSaveBar] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'success' | 'error' | 'testing'>>({});
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [serverForm, setServerForm] = useState({
    name: '',
    type: 'plex' as 'plex' | 'jellyfin',
    url: '',
    token: '',
    apiKey: '',
    adminUsername: '',
    adminPassword: '',
  });
  const [expiryInput, setExpiryInput] = useState('');
  const [maxInvitesInput, setMaxInvitesInput] = useState('');
  const [showSeerrApiKey, setShowSeerrApiKey] = useState(false);
  const [smtpPassDirty, setSmtpPassDirty] = useState(false);
  const [jellyseerrApiKeyDirty, setJellyseerrApiKeyDirty] = useState(false);
  const [discordBotTokenDirty, setDiscordBotTokenDirty] = useState(false);
  const [discordTestStatus, setDiscordTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [discordBotName, setDiscordBotName] = useState('');
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
  const [discordChannels, setDiscordChannels] = useState<DiscordChannel[]>([]);
  const [telegramBotTokenDirty, setTelegramBotTokenDirty] = useState(false);
  const [telegramTestStatus, setTelegramTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [telegramBotName, setTelegramBotName] = useState('');
  // Backup & Restore state
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [restoreSections, setRestoreSections] = useState<string[]>(['settings', 'invites', 'users', 'webhooks', 'emailTemplates', 'announcements']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkServerHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data.servers) {
          const statusMap: Record<string, 'success' | 'error'> = {};
          for (const s of data.servers) {
            statusMap[s.id] = s.healthy ? 'success' : 'error';
          }
          setConnectionStatus(statusMap);
        }
      }
    } catch {
      // Health check failed — don't overwrite existing status
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchServers().then(() => checkServerHealth());
    const interval = setInterval(checkServerHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const testConnection = async (server: Server) => {
    setConnectionStatus((prev) => ({ ...prev, [server.id]: 'testing' }));
    try {
      const res = await fetch('/api/server/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: server.id }),
      });
      setConnectionStatus((prev) => ({
        ...prev,
        [server.id]: res.ok ? 'success' : 'error',
      }));
    } catch {
      setConnectionStatus((prev) => ({ ...prev, [server.id]: 'error' }));
    }
  };

  const openAddServerModal = () => {
    setEditingServer(null);
    setServerForm({ name: '', type: 'plex', url: '', token: '', apiKey: '', adminUsername: '', adminPassword: '' });
    setIsServerModalOpen(true);
  };

  const openEditServerModal = (server: Server) => {
    setEditingServer(server);
    setServerForm({
      name: server.name,
      type: server.type,
      url: server.url,
      token: server.tokenRedacted || '',
      apiKey: server.apiKeyRedacted || '',
      adminUsername: server.adminUsernameRedacted || '',
      adminPassword: server.adminPasswordRedacted || '',
    });
    setIsServerModalOpen(true);
  };

  const handleSaveServer = async () => {
    try {
      if (editingServer) {
        // Only send credential fields if the user actually changed them
        // (redacted values start with •, so skip those)
        const isRedacted = (val: string) => val.startsWith('••••');
        const payload: Record<string, unknown> = {
          name: serverForm.name,
          type: serverForm.type,
          url: serverForm.url,
        };
        if (serverForm.token && !isRedacted(serverForm.token)) payload.token = serverForm.token;
        if (serverForm.apiKey && !isRedacted(serverForm.apiKey)) payload.apiKey = serverForm.apiKey;
        if (serverForm.adminUsername && serverForm.adminUsername !== editingServer?.adminUsernameRedacted) payload.adminUsername = serverForm.adminUsername;
        if (serverForm.adminPassword && !isRedacted(serverForm.adminPassword)) payload.adminPassword = serverForm.adminPassword;

        const res = await fetch(`/api/servers/${editingServer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          error(data.message || 'Failed to update server');
          return;
        }
      } else {
        // Filter out empty optional fields for cleaner payload
        const createPayload: Record<string, unknown> = {
          name: serverForm.name,
          type: serverForm.type,
          url: serverForm.url,
        };
        if (serverForm.token) createPayload.token = serverForm.token;
        if (serverForm.apiKey) createPayload.apiKey = serverForm.apiKey;
        if (serverForm.adminUsername) createPayload.adminUsername = serverForm.adminUsername;
        if (serverForm.adminPassword) createPayload.adminPassword = serverForm.adminPassword;

        const res = await fetch('/api/servers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          error(data.message || 'Failed to add server');
          return;
        }
      }
      success(editingServer ? 'Server updated' : 'Server added');
      setIsServerModalOpen(false);
      fetchServers();
    } catch {
      error('Failed to save server');
    }
  };

  const handleDeleteServer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this server?')) return;
    try {
      const res = await fetch(`/api/servers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        success('Server deleted');
        setServers(servers.filter((s) => s.id !== id));
      } else {
        const data = await res.json();
        error(data.message || 'Failed to delete server');
      }
    } catch {
      error('Failed to delete server');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          ...data,
          inviteProfiles: data.inviteProfiles || '[]',
          preRegisterTitle: data.preRegisterTitle || 'Before You Start',
          preRegisterSubtitle: data.preRegisterSubtitle || "Review the server rules and expectations before creating your account.",
          preRegisterChecklist: data.preRegisterChecklist || '[]',
          requireInviteAcceptance: data.requireInviteAcceptance || false,
          captchaEnabled: data.captchaEnabled || false,
          emailEnabled: data.emailEnabled || false,
          smtpHost: data.smtpHost || '',
          smtpPort: data.smtpPort ?? 587,
          smtpUser: data.smtpUser || '',
          smtpPass: '',
          smtpFrom: data.smtpFrom || '',
          hasSmtpPass: data.hasSmtpPass || false,
          notifyBeforeExpiryDays: data.notifyBeforeExpiryDays ?? 3,
          notifyOnExpiry: data.notifyOnExpiry || false,
          expiryPolicy: data.expiryPolicy || 'delete',
          expiryDeleteAfterDays: data.expiryDeleteAfterDays ?? 7,
          referralInvitesEnabled: data.referralInvitesEnabled || false,
          referralMaxUses: data.referralMaxUses ?? 1,
          referralExpiresInDays: data.referralExpiresInDays ?? 7,
          referralAccessDurationDays: data.referralAccessDurationDays ?? 0,
          referralAutoRemove: data.referralAutoRemove || false,
          jellyseerrUrl: data.jellyseerrUrl || '',
          jellyseerrApiKey: '',
          hasJellyseerrApiKey: data.hasJellyseerrApiKey || false,
          passwordMinLength: data.passwordMinLength ?? 8,
          passwordRequireUppercase: data.passwordRequireUppercase || false,
          passwordRequireNumber: data.passwordRequireNumber || false,
          passwordRequireSpecial: data.passwordRequireSpecial || false,
          welcomeEmailEnabled: data.welcomeEmailEnabled || false,
          inviteRequestsEnabled: data.inviteRequestsEnabled || false,
          inviteRequestMessage: data.inviteRequestMessage || 'Request access to join our media server',
          inviteRequestServerId: data.inviteRequestServerId || '',
          // Discord bot
          discordBotEnabled: data.discordBotEnabled || false,
          discordBotToken: '',
          discordGuildId: data.discordGuildId || '',
          discordNotifyChannelId: data.discordNotifyChannelId || '',
          discordRoleId: data.discordRoleId || '',
          hasDiscordBotToken: data.hasDiscordBotToken || false,
          // Telegram bot
          telegramBotEnabled: data.telegramBotEnabled || false,
          telegramBotToken: '',
          telegramChatId: data.telegramChatId || '',
          hasTelegramBotToken: data.hasTelegramBotToken || false,
        });
        setJellyseerrApiKeyDirty(false);
        setSmtpPassDirty(false);
        setDiscordBotTokenDirty(false);
        setTelegramBotTokenDirty(false);
        setExpiryInput(data.inviteExpiryDays?.toString() || '7');
        setMaxInvitesInput(data.maxInvites?.toString() || '100');
        if (data.accentColor) {
          applyAccentColor(data.accentColor);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyAccentColor = (hex: string) => {
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--accent-hover', hex);
    document.documentElement.style.setProperty('--accent-muted', hex + '20');
    document.documentElement.style.setProperty('--accent-glow', hex + '30');
  };

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/servers');
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      }
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    }
  };

  const handleTestDiscordBot = async () => {
    setDiscordTestStatus('testing');
    setDiscordBotName('');
    try {
      const res = await fetch('/api/admin/discord/test', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setDiscordTestStatus('success');
        setDiscordBotName(data.botName || 'Bot');
        success(`Connected as ${data.botName}`);
        // Fetch roles and channels
        const [rolesRes, channelsRes] = await Promise.all([
          fetch('/api/admin/discord/roles'),
          fetch('/api/admin/discord/channels'),
        ]);
        if (rolesRes.ok) setDiscordRoles(await rolesRes.json());
        if (channelsRes.ok) setDiscordChannels(await channelsRes.json());
      } else {
        setDiscordTestStatus('error');
        error(data.message || 'Discord connection failed');
      }
    } catch {
      setDiscordTestStatus('error');
      error('Failed to test Discord bot');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Exclude fields managed by other pages (appearance, onboarding)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { customCss, preRegisterTitle, preRegisterSubtitle, preRegisterChecklist, requireInviteAcceptance, ...settingsWithoutExcluded } = settings;
      const settingsPayload = {
        ...settingsWithoutExcluded,
        ...(jellyseerrApiKeyDirty ? { jellyseerrApiKey: settings.jellyseerrApiKey } : {}),
        ...(smtpPassDirty ? { smtpPass: settings.smtpPass } : {}),
        ...(discordBotTokenDirty ? { discordBotToken: settings.discordBotToken } : {}),
        ...(telegramBotTokenDirty ? { telegramBotToken: settings.telegramBotToken } : {}),
      };
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsPayload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        error(data.message || 'Failed to save settings');
        return;
      }
      success('Settings saved');
      setJellyseerrApiKeyDirty(false);
      setSmtpPassDirty(false);
      setDiscordBotTokenDirty(false);
      setTelegramBotTokenDirty(false);
      setShowSaveBar(false);
      // Re-fetch settings from API to get correct hasSmtpPass/hasDiscordBotToken etc.
      fetchSettings();
    } catch {
      error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setShowSaveBar(true);
  };

  // Backup & Restore handlers
  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/backup');
      if (!res.ok) {
        error('Failed to export backup');
        return;
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `portalrr-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success('Backup exported');
    } catch {
      error('Failed to export backup');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setShowRestoreModal(true);
    // Reset file input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleRestoreSection = (key: string) => {
    setRestoreSections(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  const handleRestore = async () => {
    if (!restoreFile || restoreSections.length === 0) return;

    setImporting(true);
    try {
      const text = await restoreFile.text();
      let backupData: Record<string, unknown>;
      try {
        backupData = JSON.parse(text);
      } catch {
        error('Invalid JSON file');
        setImporting(false);
        return;
      }

      if (!backupData.metadata) {
        error('Invalid backup file: missing metadata');
        setImporting(false);
        return;
      }

      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: restoreMode,
          sections: restoreSections,
          data: backupData,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        success(`Backup restored: ${result.imported?.join(', ') || 'done'}`);
        if (result.errors?.length) {
          error(`Some sections had errors: ${result.errors.join('; ')}`);
        }
        setShowRestoreModal(false);
        setRestoreFile(null);
        // Refresh settings and servers after restore
        fetchSettings();
        fetchServers();
      } else {
        const data = await res.json();
        error(data.message || 'Failed to restore backup');
      }
    } catch {
      error('Failed to restore backup');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Settings</h1>
          <div className="adm-sub">
            Servers, integrations, and platform config.
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <GeneralSection
          settings={settings}
          set={set}
          styles={styles}
          expiryInput={expiryInput}
          setExpiryInput={setExpiryInput}
          maxInvitesInput={maxInvitesInput}
          setMaxInvitesInput={setMaxInvitesInput}
        />

        <ServersSection
          settings={settings}
          set={set}
          styles={styles}
          servers={servers}
          connectionStatus={connectionStatus}
          isServerModalOpen={isServerModalOpen}
          setIsServerModalOpen={setIsServerModalOpen}
          editingServer={editingServer}
          serverForm={serverForm}
          setServerForm={setServerForm}
          onTestConnection={testConnection}
          onOpenAddServerModal={openAddServerModal}
          onOpenEditServerModal={openEditServerModal}
          onSaveServer={handleSaveServer}
          onDeleteServer={handleDeleteServer}
        />

        <IntegrationsSection
          settings={settings}
          set={set}
          styles={styles}
          showSeerrApiKey={showSeerrApiKey}
          setShowSeerrApiKey={setShowSeerrApiKey}
          jellyseerrApiKeyDirty={jellyseerrApiKeyDirty}
          setJellyseerrApiKeyDirty={setJellyseerrApiKeyDirty}
          setSettings={setSettings}
          setShowSaveBar={setShowSaveBar}
        />

        <InviteProfilesSection
          settings={settings}
          set={set}
          styles={styles}
        />

        <ReferralsSection
          settings={settings}
          set={set}
          styles={styles}
        />

        <UserLifecycleSection
          settings={settings}
          set={set}
          styles={styles}
        />

        <EmailSection
          settings={settings}
          set={set}
          styles={styles}
          setSmtpPassDirty={setSmtpPassDirty}
          setSettings={setSettings}
          setShowSaveBar={setShowSaveBar}
        />

        <DiscordBotSection
          settings={settings}
          set={set}
          styles={styles}
          discordBotTokenDirty={discordBotTokenDirty}
          setDiscordBotTokenDirty={setDiscordBotTokenDirty}
          discordTestStatus={discordTestStatus}
          discordBotName={discordBotName}
          discordRoles={discordRoles}
          discordChannels={discordChannels}
          onTestDiscordBot={handleTestDiscordBot}
          setSettings={setSettings}
          setShowSaveBar={setShowSaveBar}
        />

        <TelegramBotSection
          settings={settings}
          set={set}
          styles={styles}
          telegramBotTokenDirty={telegramBotTokenDirty}
          setTelegramBotTokenDirty={setTelegramBotTokenDirty}
          telegramTestStatus={telegramTestStatus}
          setTelegramTestStatus={setTelegramTestStatus}
          telegramBotName={telegramBotName}
          setTelegramBotName={setTelegramBotName}
          setSettings={setSettings}
          setShowSaveBar={setShowSaveBar}
          onSuccess={success}
          onError={error}
        />

        <PasswordRulesSection
          settings={settings}
          set={set}
          styles={styles}
        />

        <InviteRequestsSection
          settings={settings}
          set={set}
          styles={styles}
          servers={servers}
        />

        <SecuritySection
          settings={settings}
          set={set}
          styles={styles}
        />

        <BackupRestoreSection
          styles={styles}
          exporting={exporting}
          importing={importing}
          showRestoreModal={showRestoreModal}
          setShowRestoreModal={setShowRestoreModal}
          restoreFile={restoreFile}
          setRestoreFile={setRestoreFile}
          restoreMode={restoreMode}
          setRestoreMode={setRestoreMode}
          restoreSections={restoreSections}
          toggleRestoreSection={toggleRestoreSection}
          backupSections={BACKUP_SECTIONS}
          fileInputRef={fileInputRef}
          onExportBackup={handleExportBackup}
          onFileSelect={handleFileSelect}
          onRestore={handleRestore}
        />
      </div>

      {showSaveBar && (
        <div className={styles.saveBar}>
          <span className={styles.saveBarText}>You have unsaved changes</span>
          <Button size="sm" onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>
      )}
    </div>
  );
}
