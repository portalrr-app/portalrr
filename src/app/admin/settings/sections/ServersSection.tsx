'use client';

import { Button, Input, Modal } from '@/components';
import { SectionProps, Server } from './types';

interface ServerForm {
  name: string;
  type: 'plex' | 'jellyfin';
  url: string;
  token: string;
  apiKey: string;
  adminUsername: string;
  adminPassword: string;
}

interface ServersSectionProps extends SectionProps {
  servers: Server[];
  connectionStatus: Record<string, 'success' | 'error' | 'testing'>;
  isServerModalOpen: boolean;
  setIsServerModalOpen: (open: boolean) => void;
  editingServer: Server | null;
  serverForm: ServerForm;
  setServerForm: (form: ServerForm) => void;
  onTestConnection: (server: Server) => void;
  onOpenAddServerModal: () => void;
  onOpenEditServerModal: (server: Server) => void;
  onSaveServer: () => void;
  onDeleteServer: (id: string) => void;
}

export default function ServersSection({
  styles,
  servers,
  connectionStatus,
  isServerModalOpen,
  setIsServerModalOpen,
  editingServer,
  serverForm,
  setServerForm,
  onTestConnection,
  onOpenAddServerModal,
  onOpenEditServerModal,
  onSaveServer,
  onDeleteServer,
}: ServersSectionProps) {
  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Servers</h2>
            <p className={styles.sectionDescription}>Manage your media server connections</p>
          </div>
          <Button size="sm" onClick={onOpenAddServerModal}>+ Add Server</Button>
        </div>

        {servers.length === 0 ? (
          <div className={styles.emptyServers}>
            <p>No servers configured. Add a server to get started.</p>
          </div>
        ) : (
          <div className={styles.serverList}>
            {servers.map((server) => (
              <div key={server.id} className={styles.serverCard}>
                <div className={styles.serverIcon}>
                  {server.type === 'plex' ? (
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h4v16H4V4zm6 0h4v16h-4V4zm6 0h4v16h-4V4z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5L19 8l-7 3.5L5 8l7-3.5zM4 9.5l7 3.5v7l-7-3.5v-7zm9 10.5v-7l7-3.5v7l-7 3.5z" /></svg>
                  )}
                </div>
                <div className={styles.serverInfo}>
                  <div className={styles.serverNameRow}>
                    <div className={styles.serverName}>{server.name}</div>
                    {connectionStatus[server.id] && connectionStatus[server.id] !== 'testing' && (
                      <span className={`${styles.statusDot} ${styles[`status_${connectionStatus[server.id]}`]}`} title={connectionStatus[server.id] === 'success' ? 'Connected' : 'Unreachable'} />
                    )}
                    {connectionStatus[server.id] === 'testing' && (
                      <span className={`${styles.statusDot} ${styles.status_testing}`} title="Checking..." />
                    )}
                  </div>
                  <div className={styles.serverUrl}>{server.url}</div>
                  <div className={styles.serverMeta}>
                    <span className={styles.serverType}>{server.type}</span>
                    {server._count && server._count.invites > 0 && (
                      <span className={styles.serverInvites}>{server._count.invites} invites</span>
                    )}
                    {connectionStatus[server.id] === 'error' && (
                      <span className={styles.serverUnreachable}>Unreachable</span>
                    )}
                  </div>
                </div>
                <div className={styles.serverActions}>
                  <Button size="sm" variant="ghost" onClick={() => onTestConnection(server)} loading={connectionStatus[server.id] === 'testing'}>Test</Button>
                  <Button size="sm" variant="ghost" onClick={() => onOpenEditServerModal(server)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDeleteServer(server.id)} disabled={server._count && server._count.invites > 0} title={server._count && server._count.invites > 0 ? 'Cannot delete server with invites' : ''}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Server Modal */}
      <Modal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        title={editingServer ? 'Edit Server' : 'Add Server'}
        description="Configure connection to your media server"
        size="md"
      >
        <div className={styles.serverForm}>
          <Input
            label="Server Name"
            placeholder="My Media Server"
            value={serverForm.name}
            onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })}
          />

          <div className={styles.serverTypeSelector}>
            <label className={styles.label}>Server Type</label>
            <div className={styles.serverTypeOptions}>
              <button
                type="button"
                className={`${styles.serverTypeOption} ${serverForm.type === 'plex' ? styles.selected : ''}`}
                onClick={() => setServerForm({ ...serverForm, type: 'plex' })}
              >
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h4v16H4V4zm6 0h4v16h-4V4zm6 0h4v16h-4V4z" /></svg>
                Plex
              </button>
              <button
                type="button"
                className={`${styles.serverTypeOption} ${serverForm.type === 'jellyfin' ? styles.selected : ''}`}
                onClick={() => setServerForm({ ...serverForm, type: 'jellyfin' })}
              >
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5L19 8l-7 3.5L5 8l7-3.5zM4 9.5l7 3.5v7l-7-3.5v-7zm9 10.5v-7l7-3.5v7l-7 3.5z" /></svg>
                Jellyfin
              </button>
            </div>
          </div>

          <Input
            label="Server URL"
            placeholder="https://media.example.com"
            value={serverForm.url}
            onChange={(e) => setServerForm({ ...serverForm, url: e.target.value })}
          />

          {serverForm.type === 'plex' ? (
            <Input
              label="Plex Token"
              type="password"
              value={serverForm.token}
              onChange={(e) => setServerForm({ ...serverForm, token: e.target.value })}
              hint="Find your token at plex.tv pin"
            />
          ) : (
            <>
              <Input
                label="API Key"
                type="password"
                value={serverForm.apiKey}
                onChange={(e) => setServerForm({ ...serverForm, apiKey: e.target.value })}
                hint="Found in Jellyfin dashboard > API Keys"
              />
              <div className={styles.adminCredentialsCard}>
                <p className={styles.adminCredentialsTitle}>
                  Admin Credentials (Optional)
                </p>
                <p className={styles.adminCredentialsDesc}>
                  Required for password reset/sync. API keys cannot change passwords due to a Jellyfin limitation.
                </p>
                <div className={styles.adminCredentialsFields}>
                  <Input
                    label="Admin Username"
                    value={serverForm.adminUsername}
                    onChange={(e) => setServerForm({ ...serverForm, adminUsername: e.target.value })}
                  />
                  <Input
                    label="Admin Password"
                    type="password"
                    value={serverForm.adminPassword}
                    onChange={(e) => setServerForm({ ...serverForm, adminPassword: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          <div className={styles.modalActions}>
            <Button variant="secondary" fullWidth onClick={() => setIsServerModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={onSaveServer}>{editingServer ? 'Save Changes' : 'Add Server'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
