'use client';

import { useEffect, useState } from 'react';
import { Button, Modal, Input, StatusBadge } from '@/components';
import { useToast } from '@/hooks/useToast';
import styles from './page.module.css';

interface Library {
  id: string;
  name: string;
  type: string;
}

interface Server {
  id: string;
  name: string;
  type: string;
}

interface UserServerMembership {
  serverId: string;
  serverName: string;
  serverType: string;
  remoteUserId: string | null;
  libraries: string[];
  disabled: boolean;
}

interface User {
  id: string;
  localId?: string | null;
  remoteUserId?: string | null;
  username: string;
  email: string | null;
  accessUntil: string | null;
  autoRemove: boolean;
  enableLiveTv: boolean;
  allLibraries: boolean;
  createdAt?: string;
  source: 'local' | 'jellyfin' | 'plex';
  serverId: string;
  serverName: string;
  lastSeen?: string;
  libraries?: string[];
  invite?: {
    code: string;
  } | null;
  ghost?: boolean;
  ghostServers?: string[];
  servers?: UserServerMembership[];
  isAdmin?: boolean;
  notes?: string | null;
  labels?: string[];
  discordUsername?: string | null;
  telegramUsername?: string | null;
}

interface InviteProfile {
  name: string;
  accessDurationDays?: number;
  autoRemove?: boolean;
  enableLiveTv?: boolean;
  allLibraries?: boolean;
  libraries?: string[];
}

type FilterType = 'all' | 'jellyfin' | 'plex';

export default function UsersPage() {
  const { success, error, info } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  // Hydrate the filter from the ?q= URL param (used by the top-bar search).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URL(window.location.href).searchParams.get('q') || '';
    setSearch(q);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [accessInput, setAccessInput] = useState('0');
  const [autoRemove, setAutoRemove] = useState(false);
  const [enableLiveTv, setEnableLiveTv] = useState(true);
  const [allLibraries, setAllLibraries] = useState(false);
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDiscordUsername, setEditDiscordUsername] = useState('');
  const [editTelegramUsername, setEditTelegramUsername] = useState('');

  // Reset password state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetting, setResetting] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<InviteProfile[]>([]);
  const [bulkProfile, setBulkProfile] = useState('');

  // Current admin info
  const [currentAdmin, setCurrentAdmin] = useState<{ username: string; source: string; serverId?: string | null } | null>(null);

  // Server access state
  const [isServerAccessModalOpen, setIsServerAccessModalOpen] = useState(false);
  const [serverAccessUser, setServerAccessUser] = useState<User | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [serverAccessLibraries, setServerAccessLibraries] = useState<Library[]>([]);
  const [selectedServerLibraries, setSelectedServerLibraries] = useState<string[]>([]);
  const [serverAccessLoading, setServerAccessLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchProfiles();
    fetch('/api/admin/me').then(r => r.ok ? r.json() : null).then(d => d && setCurrentAdmin(d)).catch(() => {});
  }, [filter]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`/api/users?source=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLibraries = async (serverId: string) => {
    try {
      const res = await fetch(`/api/libraries?serverId=${serverId}`);
      if (res.ok) {
        const data = await res.json();
        setLibraries(data);
      }
    } catch (error) {
      console.error('Failed to fetch libraries:', error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();
      const parsed = data.inviteProfiles ? JSON.parse(data.inviteProfiles) : [];
      setProfiles(Array.isArray(parsed) ? parsed : []);
    } catch {
      setProfiles([]);
    }
  };

  const handleEditUser = async (user: User) => {
    setEditingUser(user);
    setAutoRemove(user.autoRemove);
    setEnableLiveTv(user.enableLiveTv ?? true);
    setAllLibraries(user.allLibraries ?? false);
    setSelectedLibraries(user.libraries || []);
    setEditEmail(user.email || '');
    setEditNotes(user.notes || '');
    setEditDiscordUsername(user.discordUsername || '');
    setEditTelegramUsername(user.telegramUsername || '');
    
    if (user.accessUntil) {
      const diff = Math.ceil((new Date(user.accessUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      setAccessInput(diff > 0 ? diff.toString() : '0');
    } else {
      setAccessInput('0');
    }
    
    await fetchLibraries(user.serverId);
    setIsEditModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const accessDurationDays = parseInt(accessInput) || 0;
      const accessUntil = accessDurationDays > 0
        ? new Date(Date.now() + accessDurationDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          localId: editingUser.localId || undefined,
          remoteUserId: editingUser.remoteUserId || undefined,
          accessUntil,
          autoRemove,
          enableLiveTv,
          allLibraries,
          libraries: allLibraries ? [] : selectedLibraries,
          source: editingUser.source,
          serverId: editingUser.serverId,
          email: editEmail || null,
          notes: editNotes || null,
          discordUsername: editDiscordUsername || null,
          telegramUsername: editTelegramUsername || null,
        }),
      });
      if (res.ok) {
        success('User updated successfully');
        setIsEditModalOpen(false);
        fetchUsers();
      } else {
        const data = await res.json();
        error(data.message || 'Failed to update user');
      }
    } catch {
      error('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleRecreateUser = async (user: User, serverId: string) => {
    const serverName = user.servers?.find(s => s.serverId === serverId)?.serverName || 'server';
    if (!confirm(`Recreate ${user.username} on ${serverName}? A password reset email will be sent.`)) return;
    try {
      const res = await fetch('/api/users/recreate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.localId || user.id,
          serverId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        success(data.message || 'User recreated');
        fetchUsers();
      } else {
        error(data.message || 'Failed to recreate user');
      }
    } catch {
      error('Failed to recreate user');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.isAdmin) {
      if (!confirm(`⚠️ "${user.username}" is a server administrator.\n\nThis will delete their account from ${user.serverName}. If this is the admin account Portalrr uses to connect, it will break the server connection.\n\nAre you sure?`)) return;
    } else {
      if (!confirm(`Are you sure you want to delete ${user.username}?`)) return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          localId: user.localId || undefined,
          remoteUserId: user.remoteUserId || undefined,
          source: user.source,
          serverId: user.serverId,
        }),
      });
      if (res.ok) {
        success('User deleted');
        setUsers(users.filter((u) => !(u.id === user.id && u.serverId === user.serverId)));
      } else {
        error('Failed to delete user');
      }
    } catch {
      error('Failed to delete user');
    }
  };

  const toggleLibrary = (libId: string) => {
    setSelectedLibraries(prev => 
      prev.includes(libId) 
        ? prev.filter(id => id !== libId)
        : [...prev, libId]
    );
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleBulkDelete = async () => {
    const selectedUsers = users.filter((user) => selectedUserIds.includes(user.id));
    if (selectedUsers.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedUsers.length} user(s)? This cannot be undone.`)) return;

    const res = await fetch('/api/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        userIds: selectedUsers.map((user) => user.id),
        localIds: selectedUsers.map((user) => user.localId).filter(Boolean),
        remoteUserIds: selectedUsers.map((user) => user.remoteUserId).filter(Boolean),
        serverId: selectedUsers[0]?.serverId,
      }),
    });

    if (res.ok) {
      success('Selected users deleted');
      setSelectedUserIds([]);
      fetchUsers();
    } else {
      error('Failed to delete selected users');
    }
  };

  const handleBulkApplyProfile = async () => {
    const profile = profiles.find((item) => item.name === bulkProfile);
    const selectedUsers = users.filter((user) => selectedUserIds.includes(user.id));
    if (!profile || selectedUsers.length === 0) return;

    const res = await fetch('/api/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'apply_profile',
        userIds: selectedUsers.map((user) => user.id),
        localIds: selectedUsers.map((user) => user.localId).filter(Boolean),
        remoteUserIds: selectedUsers.map((user) => user.remoteUserId).filter(Boolean),
        serverId: selectedUsers[0]?.serverId,
        profile,
      }),
    });

    if (res.ok) {
      success('Profile applied to selected users');
      setSelectedUserIds([]);
      setBulkProfile('');
      fetchUsers();
    } else {
      error('Failed to apply profile');
    }
  };

  const handleResetPassword = (user: User) => {
    if (user.source === 'plex') {
      info('Plex passwords are managed through plex.tv and cannot be reset here.');
      return;
    }
    if (user.isAdmin) {
      if (!confirm(`"${user.username}" is a server administrator. Changing their password will also change it on ${user.serverName}. Continue?`)) return;
    }
    setResetUser(user);
    setResetPassword('');
    setResetConfirm('');
    setResetError('');
    setResetSuccess('');
    setIsResetModalOpen(true);
  };

  const handleResetSubmit = async () => {
    if (!resetUser) return;
    setResetError('');
    setResetSuccess('');

    if (resetPassword.length < 8) {
      setResetError('Password must be at least 8 characters');
      return;
    }
    if (resetPassword !== resetConfirm) {
      setResetError('Passwords do not match');
      return;
    }

    setResetting(true);
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: resetUser.id,
          localId: resetUser.localId || undefined,
          remoteUserId: resetUser.remoteUserId || undefined,
          newPassword: resetPassword,
          source: resetUser.localId ? 'local' : resetUser.source,
          serverId: resetUser.serverId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.jellyfinSynced) {
          setResetSuccess('Password reset! Jellyfin password has been synced.');
        } else if (resetUser.source === 'jellyfin') {
          setResetSuccess('Password reset! Note: Jellyfin password could not be synced — check admin credentials in server settings.');
        } else {
          setResetSuccess('Password reset successfully!');
        }
        setResetPassword('');
        setResetConfirm('');
      } else {
        setResetError(data.message || 'Failed to reset password');
      }
    } catch {
      setResetError('Something went wrong');
    } finally {
      setResetting(false);
    }
  };

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/servers');
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      }
    } catch {
      setServers([]);
    }
  };

  const handleServerAccess = async (user: User) => {
    setServerAccessUser(user);
    setSelectedServerId('');
    setServerAccessLibraries([]);
    setSelectedServerLibraries([]);
    await fetchServers();
    setIsServerAccessModalOpen(true);
  };

  const handleServerSelect = async (serverId: string) => {
    setSelectedServerId(serverId);
    setSelectedServerLibraries([]);
    if (serverId) {
      try {
        const res = await fetch(`/api/libraries?serverId=${serverId}`);
        if (res.ok) {
          const data = await res.json();
          setServerAccessLibraries(data);
        }
      } catch {
        setServerAccessLibraries([]);
      }
    } else {
      setServerAccessLibraries([]);
    }
  };

  const handleGrantAccess = async () => {
    if (!serverAccessUser || !selectedServerId) return;
    setServerAccessLoading(true);
    try {
      const res = await fetch('/api/users/server-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: serverAccessUser.localId || serverAccessUser.id,
          serverId: selectedServerId,
          libraries: selectedServerLibraries,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        success(data.message || 'Server access granted');
        setIsServerAccessModalOpen(false);
        fetchUsers();
      } else {
        error(data.message || 'Failed to grant access');
      }
    } catch {
      error('Failed to grant server access');
    } finally {
      setServerAccessLoading(false);
    }
  };

  const handleRevokeAccess = async (user: User, action: 'disable' | 'delete') => {
    const actionLabel = action === 'disable' ? 'Disable' : 'Delete';
    const actionDesc = action === 'disable'
      ? `Disable ${user.username} on ${user.serverName}? Their account will be disabled but watch history and settings are preserved.`
      : `Delete ${user.username} from ${user.serverName}? This permanently removes their account from the server.`;
    if (!confirm(actionDesc)) return;
    try {
      const res = await fetch('/api/users/server-access', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.localId || user.id,
          serverId: user.serverId,
          action,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        success(data.message || `Server access ${action === 'disable' ? 'disabled' : 'revoked'}`);
        fetchUsers();
      } else {
        error(data.message || `Failed to ${actionLabel.toLowerCase()} access`);
      }
    } catch {
      error(`Failed to ${actionLabel.toLowerCase()} server access`);
    }
  };

  const handleEnableAccess = async (user: User, serverId: string, serverName: string) => {
    if (!confirm(`Re-enable ${user.username} on ${serverName}?`)) return;
    try {
      const res = await fetch('/api/users/server-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.localId || user.id,
          serverId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        success(data.message || 'Server access re-enabled');
        fetchUsers();
      } else {
        error(data.message || 'Failed to enable access');
      }
    } catch {
      error('Failed to enable server access');
    }
  };

  const filters: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'jellyfin', label: 'Jellyfin' },
    { value: 'plex', label: 'Plex' },
  ];

  const getStatus = (user: User) => {
    if (!user.accessUntil) return 'active';
    return new Date(user.accessUntil) < new Date() ? 'expired' : 'active';
  };

  const visibleUsers = (() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter((u) =>
      u.username.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.serverName || '').toLowerCase().includes(q) ||
      (u.notes || '').toLowerCase().includes(q),
    );
  })();

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>
            Users
            {users.length > 0 && (
              <span style={{ color: 'var(--text-tertiary)', fontSize: 18, fontWeight: 500, fontFamily: 'var(--font-body)', marginLeft: 10 }}>
                {users.length}
              </span>
            )}
          </h1>
          <div className="adm-sub">
            Everyone with access to your media servers.
          </div>
        </div>
      </div>

      <div className={styles.filters}>
        {filters.map((f) => (
          <button
            key={f.value}
            className={`${styles.filterButton} ${filter === f.value ? styles.active : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selectedUserIds.length > 0 && (
        <div className={styles.filters} style={{ alignItems: 'center' }}>
          <span>{selectedUserIds.length} selected</span>
          <select
            className={styles.filterButton}
            value={bulkProfile}
            onChange={(e) => setBulkProfile(e.target.value)}
          >
            <option value="">Apply profile</option>
            {profiles.map((profile) => (
              <option key={profile.name} value={profile.name}>
                {profile.name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={handleBulkApplyProfile} disabled={!bulkProfile}>
            Apply Profile
          </Button>
          <Button size="sm" variant="danger" onClick={handleBulkDelete}>
            Delete Selected
          </Button>
        </div>
      )}

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <div>Select</div>
          <div>Username</div>
          <div>Email</div>
          <div>Server</div>
          <div>Access</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            <p>Loading...</p>
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateTitle}>
              {users.length === 0 ? 'No users found' : 'No matches'}
            </p>
            <p className={styles.emptyStateText}>
              {users.length === 0
                ? 'Users from your media servers will appear here'
                : `Nothing matched "${search}". Try a different query or filter.`}
            </p>
          </div>
        ) : (
          visibleUsers.map((user) => (
            <div key={`${user.source}-${user.id}`} className={styles.tableRow}>
              <div data-label="Select">
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(user.id)}
                  onChange={() => toggleUserSelection(user.id)}
                />
              </div>
              <div data-label="Username">
                <span className={styles.username}>{user.username}</span>
                <span className={`${styles.sourceTag} ${styles[user.source]}`}>
                  {user.source}
                </span>
                {user.isAdmin && (
                  <span className={styles.adminTag} title="Server administrator">
                    Admin
                  </span>
                )}
                {user.ghost && (
                  <span className={styles.ghostTag} title="User no longer exists on the media server">
                    Ghost
                  </span>
                )}
              </div>
              <div data-label="Email" className={styles.email}>
                {user.email || '-'}
              </div>
              <div data-label="Server" className={styles.serverType}>
                {user.servers && user.servers.length > 0 ? (
                  <div className={styles.serverList}>
                    {user.servers.map((s) => (
                      <span key={s.serverId} className={`${styles.serverChip} ${user.ghostServers?.includes(s.serverId) ? styles.ghostChip : ''}`}>
                        {s.serverName}
                        {user.ghostServers?.includes(s.serverId) && (
                          <button
                            className={styles.recreateBtn}
                            title={`Recreate on ${s.serverName}`}
                            onClick={(e) => { e.stopPropagation(); handleRecreateUser(user, s.serverId); }}
                          >
                            ↻
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <>
                    <span className={styles.serverIcon}>
                      {user.source === 'plex' ? (
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h4v16H4V4zm6 0h4v16h-4V4zm6 0h4v16h-4V4z" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5L19 8l-7 3.5L5 8l7-3.5zM4 9.5l7 3.5v7l-7-3.5v-7zm9 10.5v-7l7-3.5v7l-7 3.5z" /></svg>
                      )}
                    </span>
                    {user.serverName}
                  </>
                )}
              </div>
              <div data-label="Access" className={styles.access}>
                {user.accessUntil ? (
                  <span title={user.autoRemove ? "Auto-remove when expired" : ""}>
                    {new Date(user.accessUntil).toLocaleDateString()}
                    {user.autoRemove && <span className={styles.autoRemove}> ↺</span>}
                  </span>
                ) : (
                  <span className={styles.permanent}>Permanent</span>
                )}
              </div>
              <div data-label="Status">
                <StatusBadge status={getStatus(user)} />
              </div>
              <div data-label="Actions" className={styles.actions}>
                {(() => {
                  // Non-local admins (Jellyfin/Plex) cannot manage admin users
                  const isSelf = currentAdmin && currentAdmin.source !== 'local' &&
                    user.username.toLowerCase() === currentAdmin.username.toLowerCase();
                  const adminProtected = user.isAdmin && currentAdmin?.source !== 'local';
                  const blocked = isSelf || adminProtected;

                  return (
                    <>
                      <button
                        className={`${styles.actionButton} ${styles.server}`}
                        onClick={() => handleServerAccess(user)}
                        title={blocked ? 'Only the Portalrr admin can manage this account' : user.serverId ? 'Manage server access' : 'Grant server access'}
                        disabled={!!blocked}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                          <line x1="6" y1="6" x2="6.01" y2="6" />
                          <line x1="6" y1="18" x2="6.01" y2="18" />
                        </svg>
                      </button>
                      <button
                        className={styles.actionButton}
                        onClick={() => handleResetPassword(user)}
                        title={blocked ? 'Only the Portalrr admin can manage this account' : user.source === 'plex' ? 'Plex passwords managed on plex.tv' : 'Reset password'}
                        disabled={user.source === 'plex' || !!blocked}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </button>
                      <button
                        className={styles.actionButton}
                        onClick={() => handleEditUser(user)}
                        title={blocked ? 'Only the Portalrr admin can manage this account' : 'Edit user'}
                        disabled={!!blocked}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className={`${styles.actionButton} ${styles.danger}`}
                        onClick={() => handleDeleteUser(user)}
                        title={blocked ? 'Only the Portalrr admin can manage this account' : user.isAdmin ? 'Delete server admin account' : 'Delete user'}
                        disabled={!!blocked}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit User"
        description="Manage user access and settings"
        size="lg"
      >
        <div className={styles.editForm}>
          {editingUser && (
            <>
              <div className={styles.userInfo}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Username</span>
                  <span className={styles.infoValue}>{editingUser.username}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{editEmail || '-'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Server</span>
                  <span className={styles.infoValue}>{editingUser.serverName} ({editingUser.source})</span>
                </div>
                {editingUser.invite && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Invite Code</span>
                    <span className={styles.infoValue}>{editingUser.invite.code}</span>
                  </div>
                )}
              </div>

              <div className={styles.section}>
                <Input
                  label="Access Duration (Days)"
                  type="text"
                  inputMode="numeric"
                  value={accessInput}
                  onChange={(e) => setAccessInput(e.target.value.replace(/[^0-9]/g, ''))}
                  hint="0 = permanent access"
                />
              </div>

              <div className={styles.section}>
                <div className={styles.checkboxWrapper}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={allLibraries}
                      onChange={(e) => setAllLibraries(e.target.checked)}
                    />
                    <span className={styles.checkboxLabel}>Access to all libraries</span>
                  </label>
                </div>

                {!allLibraries && libraries.length > 0 && (
                  <div className={styles.libraryGrid}>
                    {libraries.map((lib) => (
                      <label key={lib.id} className={styles.libraryItem}>
                        <input
                          type="checkbox"
                          checked={selectedLibraries.includes(lib.id)}
                          onChange={() => toggleLibrary(lib.id)}
                        />
                        <span>{lib.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.section}>
                <div className={styles.checkboxWrapper}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={enableLiveTv}
                      onChange={(e) => setEnableLiveTv(e.target.checked)}
                    />
                    <span className={styles.checkboxLabel}>Enable Live TV</span>
                  </label>
                </div>
              </div>

              <div className={styles.checkboxWrapper}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={autoRemove}
                    onChange={(e) => setAutoRemove(e.target.checked)}
                  />
                  <span className={styles.checkboxLabel}>Auto-remove when access expires</span>
                </label>
              </div>

              <div className={styles.section} style={{ marginTop: 16 }}>
                <span className={styles.label}>Notes</span>
                <textarea
                  className={styles.serverSelect}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Admin notes about this user..."
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className={styles.section}>
                <span className={styles.label} style={{ marginBottom: 8 }}>Contact Info</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Input
                    label="Email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                  <Input
                    label="Discord Username"
                    type="text"
                    value={editDiscordUsername}
                    onChange={(e) => setEditDiscordUsername(e.target.value)}
                    placeholder="e.g. user#1234"
                  />
                  <Input
                    label="Telegram Username"
                    type="text"
                    value={editTelegramUsername}
                    onChange={(e) => setEditTelegramUsername(e.target.value)}
                    placeholder="e.g. @username"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <Button variant="secondary" fullWidth onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button fullWidth loading={saving} onClick={handleSaveUser}>
                  Save Changes
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isServerAccessModalOpen}
        onClose={() => setIsServerAccessModalOpen(false)}
        title="Server Access"
        description={`Manage server access for ${serverAccessUser?.username}`}
        size="lg"
      >
        <div className={styles.editForm}>
          {serverAccessUser && (
            <>
              <div className={styles.userInfo}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Username</span>
                  <span className={styles.infoValue}>{serverAccessUser.username}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{serverAccessUser.email || '-'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Current Server</span>
                  <span className={styles.infoValue}>
                    {serverAccessUser.serverId ? `${serverAccessUser.serverName} (${serverAccessUser.source})` : 'None'}
                  </span>
                </div>
              </div>

              {serverAccessUser.servers && serverAccessUser.servers.length > 0 && (
                <div className={styles.section}>
                  <label className={styles.label}>Current Servers</label>
                  <div className={styles.membershipList}>
                    {serverAccessUser.servers.map((s) => (
                      <div key={s.serverId} className={styles.membershipItem}>
                        <span className={styles.membershipName}>
                          {s.serverName}
                          <span className={styles.membershipType}>{s.serverType}</span>
                          {s.disabled && <span className={styles.disabledTag}>Disabled</span>}
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {s.disabled ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                handleEnableAccess(serverAccessUser, s.serverId, s.serverName);
                              }}
                            >
                              Enable
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                handleRevokeAccess({ ...serverAccessUser, serverId: s.serverId, serverName: s.serverName }, 'disable');
                              }}
                            >
                              Disable
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              handleRevokeAccess({ ...serverAccessUser, serverId: s.serverId, serverName: s.serverName }, 'delete');
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {serverAccessUser.serverId && (!serverAccessUser.servers || serverAccessUser.servers.length === 0) && (
                <div className={styles.section}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    This user currently has access to <strong>{serverAccessUser.serverName}</strong>.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={serverAccessLoading}
                      onClick={async () => {
                        await handleRevokeAccess(serverAccessUser, 'disable');
                      }}
                    >
                      Disable Access
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={serverAccessLoading}
                      onClick={async () => {
                        await handleRevokeAccess(serverAccessUser, 'delete');
                        setIsServerAccessModalOpen(false);
                      }}
                    >
                      Delete from Server
                    </Button>
                  </div>
                </div>
              )}

              <div className={styles.section}>
                <label className={styles.label}>{(serverAccessUser.servers?.length || 0) > 0 ? 'Add to Another Server' : 'Select Server'}</label>
                <select
                  className={styles.serverSelect}
                  value={selectedServerId}
                  onChange={(e) => handleServerSelect(e.target.value)}
                >
                  <option value="">Choose a server...</option>
                  {servers
                    .filter((s) => {
                      const existingServerIds = serverAccessUser.servers?.map((m) => m.serverId) || [];
                      if (serverAccessUser.serverId) existingServerIds.push(serverAccessUser.serverId);
                      return !existingServerIds.includes(s.id);
                    })
                    .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </option>
                  ))}
                </select>
              </div>

              {selectedServerId && serverAccessLibraries.length > 0 && (
                <div className={styles.section}>
                  <label className={styles.label}>Library Access (leave empty for all)</label>
                  <div className={styles.libraryGrid}>
                    {serverAccessLibraries.map((lib) => (
                      <label key={lib.id} className={styles.libraryItem}>
                        <input
                          type="checkbox"
                          checked={selectedServerLibraries.includes(lib.id)}
                          onChange={() => {
                            setSelectedServerLibraries(prev =>
                              prev.includes(lib.id)
                                ? prev.filter(id => id !== lib.id)
                                : [...prev, lib.id]
                            );
                          }}
                        />
                        <span>{lib.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedServerId && servers.find(s => s.id === selectedServerId)?.type === 'plex' && !serverAccessUser.email && (
                <div className={styles.warningMessage}>
                  Plex requires an email address to send invites. This user has no email on file.
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <Button variant="secondary" fullWidth onClick={() => setIsServerAccessModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  fullWidth
                  loading={serverAccessLoading}
                  onClick={handleGrantAccess}
                  disabled={!selectedServerId}
                >
                  Grant Access
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Reset Password"
        description={`Set a new password for ${resetUser?.username}`}
      >
        <div className={styles.editForm}>
          {resetSuccess ? (
            <>
              <div className={styles.successMessage}>{resetSuccess}</div>
              <Button fullWidth onClick={() => setIsResetModalOpen(false)} style={{ marginTop: 16 }}>
                Close
              </Button>
            </>
          ) : (
            <>
              <div className={styles.section}>
                <Input
                  label="New Password"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  autoComplete="new-password"
                  hint="Minimum 8 characters"
                />
              </div>
              <div className={styles.section}>
                <Input
                  label="Confirm Password"
                  type="password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  error={resetError}
                  autoComplete="new-password"
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <Button variant="secondary" fullWidth onClick={() => setIsResetModalOpen(false)}>
                  Cancel
                </Button>
                <Button fullWidth loading={resetting} onClick={handleResetSubmit}>
                  Reset Password
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
