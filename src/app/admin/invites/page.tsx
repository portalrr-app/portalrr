'use client';

import { useEffect, useState } from 'react';
import { Button, StatusBadge } from '@/components';
import { useToast } from '@/hooks/useToast';
import { CreateInviteModal, EditInviteModal } from './InviteModals';
import type { CreateInviteForm, EditInviteForm } from './InviteModals';
import styles from './page.module.css';

interface Server {
  id: string;
  name: string;
  type: 'plex' | 'jellyfin';
  url: string;
  isActive: boolean;
}

interface Invite {
  id: string;
  code: string;
  label: string | null;
  serverId: string;
  server: Server | null;
  libraries: string[];
  accessUntil: string | null;
  accessDurationDays: number;
  autoRemove: boolean;
  expiresAt: string | null;
  maxUses: number;
  uses: number;
  status: 'active' | 'expired' | 'cancelled' | 'used';
  createdAt: string;
  email: string | null;
  notifyOnUse: boolean;
  notifyOnExpiry: boolean;
}

interface Library {
  id: string;
  name: string;
}

interface InviteProfile {
  name: string;
  accessDurationDays?: number;
  autoRemove?: boolean;
  libraries?: string[];
  allLibraries?: boolean;
}

type FilterType = 'all' | 'active' | 'used' | 'expired';

const DEFAULT_CREATE_FORM: CreateInviteForm = {
  serverId: '',
  maxUses: 0,
  expiresInDays: 7,
  accessDurationDays: 0,
  autoRemove: false,
  libraries: [],
  codeType: 'random',
  pinLength: 6,
  customCode: '',
  label: '',
  passphrase: '',
  notifyOnUse: false,
  notifyOnExpiry: false,
};

export default function InvitesPage() {
  const { success, error, info } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState<CreateInviteForm>(DEFAULT_CREATE_FORM);
  const [maxUsesInput, setMaxUsesInput] = useState('0');
  const [expiresInput, setExpiresInput] = useState('7');
  const [accessInput, setAccessInput] = useState('0');
  const [profiles, setProfiles] = useState<InviteProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState('');

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInvite, setEditingInvite] = useState<Invite | null>(null);
  const [editForm, setEditForm] = useState<EditInviteForm>({
    maxUses: '', expiresInDays: '', accessDurationDays: '',
    autoRemove: false, libraries: [], label: '', passphrase: '',
    notifyOnUse: false, notifyOnExpiry: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchServers();
    fetchInvites();
    fetchLibraries();
    fetchProfiles();
  }, [filter]);

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/servers');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setServers(list.filter((s: Server) => s.isActive));
        if (list.length > 0 && !newInvite.serverId) {
          setNewInvite(prev => ({ ...prev, serverId: list[0].id }));
        }
      }
    } catch {
      setServers([]);
    }
  };

  const fetchInvites = async () => {
    try {
      const res = await fetch(`/api/invites?filter=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setInvites(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch invites:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLibraries = async () => {
    try {
      const res = await fetch('/api/libraries');
      if (res.ok) setLibraries(await res.json());
    } catch {
      setLibraries([]);
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

  const handleCreateInvite = async () => {
    if (!newInvite.serverId) { error('Please select a server'); return; }
    const payload: Record<string, unknown> = {
      serverId: newInvite.serverId,
      maxUses: Number.isNaN(parseInt(maxUsesInput)) ? 1 : parseInt(maxUsesInput),
      expiresInDays: parseInt(expiresInput) || 0,
      accessDurationDays: parseInt(accessInput) || 0,
      autoRemove: newInvite.autoRemove,
      libraries: newInvite.libraries,
      codeType: newInvite.codeType,
      notifyOnUse: newInvite.notifyOnUse,
      notifyOnExpiry: newInvite.notifyOnExpiry,
    };
    if (newInvite.label.trim()) payload.label = newInvite.label.trim();
    if (newInvite.passphrase.trim()) payload.passphrase = newInvite.passphrase.trim();
    if (newInvite.codeType === 'pin') payload.pinLength = newInvite.pinLength;
    if (newInvite.codeType === 'custom' && newInvite.customCode) payload.customCode = newInvite.customCode;

    setCreating(true);
    try {
      const res = await fetch('/api/invites/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        success('Invite created successfully');
        setIsCreateModalOpen(false);
        setNewInvite({ ...DEFAULT_CREATE_FORM, serverId: servers[0]?.id || '' });
        setMaxUsesInput('0');
        setExpiresInput('7');
        setAccessInput('0');
        fetchInvites();
      } else {
        const data = await res.json();
        error(data.message || 'Failed to create invite');
      }
    } catch {
      error('Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteInvite = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invite?')) return;
    try {
      const res = await fetch(`/api/invites/${id}`, { method: 'DELETE' });
      if (res.ok) {
        success('Invite deleted');
        setInvites(invites.filter((inv) => inv.id !== id));
      } else {
        error('Failed to delete invite');
      }
    } catch {
      error('Failed to delete invite');
    }
  };

  const copyInviteLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
    info('Invite link copied to clipboard');
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    info('Invite code copied to clipboard');
  };

  const openEditModal = (invite: Invite) => {
    setEditingInvite(invite);
    setEditForm({
      maxUses: String(invite.maxUses),
      expiresInDays: '',
      accessDurationDays: String(invite.accessDurationDays),
      autoRemove: invite.autoRemove,
      libraries: invite.libraries || [],
      label: invite.label || '',
      passphrase: '',
      notifyOnUse: invite.notifyOnUse ?? false,
      notifyOnExpiry: invite.notifyOnExpiry ?? false,
    });
    setIsEditModalOpen(true);
  };

  const handleEditInvite = async () => {
    if (!editingInvite) return;
    const payload: Record<string, unknown> = {};
    const maxUses = parseInt(editForm.maxUses);
    if (!isNaN(maxUses)) payload.maxUses = maxUses;
    const expDays = parseInt(editForm.expiresInDays);
    if (!isNaN(expDays) && editForm.expiresInDays !== '') payload.expiresInDays = expDays;
    const accessDays = parseInt(editForm.accessDurationDays);
    if (!isNaN(accessDays)) payload.accessDurationDays = accessDays;
    payload.autoRemove = editForm.autoRemove;
    payload.libraries = editForm.libraries;
    payload.label = editForm.label.trim();
    payload.notifyOnUse = editForm.notifyOnUse;
    payload.notifyOnExpiry = editForm.notifyOnExpiry;
    if (editForm.passphrase.trim()) payload.passphrase = editForm.passphrase.trim();

    setSaving(true);
    try {
      const res = await fetch(`/api/invites/${editingInvite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        success('Invite updated');
        setIsEditModalOpen(false);
        setEditingInvite(null);
        fetchInvites();
      } else {
        const data = await res.json();
        error(data.message || 'Failed to update invite');
      }
    } catch {
      error('Failed to update invite');
    } finally {
      setSaving(false);
    }
  };

  const applyProfile = (profileName: string) => {
    setSelectedProfile(profileName);
    const profile = profiles.find((item) => item.name === profileName);
    if (!profile) return;
    const days = profile.accessDurationDays ?? 0;
    setAccessInput(String(days));
    setNewInvite((prev) => ({
      ...prev,
      accessDurationDays: days,
      autoRemove: profile.autoRemove ?? prev.autoRemove,
      libraries: profile.allLibraries ? [] : (profile.libraries || []),
    }));
  };

  const saveCurrentAsProfile = async () => {
    const name = prompt('Profile name');
    if (!name) return;
    const nextProfiles = [
      ...profiles.filter((profile) => profile.name !== name),
      {
        name,
        accessDurationDays: parseInt(accessInput) || 0,
        autoRemove: newInvite.autoRemove,
        libraries: newInvite.libraries,
        allLibraries: newInvite.libraries.length === 0,
      },
    ];
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteProfiles: JSON.stringify(nextProfiles) }),
    });
    if (res.ok) {
      setProfiles(nextProfiles);
      setSelectedProfile(name);
      success('Profile saved');
    } else {
      error('Failed to save profile');
    }
  };

  const filters: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'used', label: 'Used' },
    { value: 'expired', label: 'Expired' },
  ];

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Invites</h1>
          <p className={styles.subtitle}>Manage invite codes for new users</p>
        </div>
        <Button onClick={() => servers.length > 0 && setIsCreateModalOpen(true)} disabled={servers.length === 0} title={servers.length === 0 ? 'Add a server in Settings first' : ''}>
          Create Invite
        </Button>
      </div>

      <div className={styles.filters}>
        {filters.map((f) => (
          <button key={f.value} className={`${styles.filterButton} ${filter === f.value ? styles.active : ''}`} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <div>Code</div>
          <div>Server</div>
          <div>Uses</div>
          <div>Access</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {loading ? (
          <div className={styles.emptyState}><p>Loading...</p></div>
        ) : invites.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateTitle}>No invites found</p>
            <p className={styles.emptyStateText}>Create your first invite to get started</p>
            <Button onClick={() => servers.length > 0 && setIsCreateModalOpen(true)} disabled={servers.length === 0}>Create Invite</Button>
          </div>
        ) : (
          invites.map((invite) => (
            <div key={invite.id} className={styles.tableRow}>
              <div data-label="Code">
                <span className={styles.code}>{invite.code}</span>
                {invite.label && <span className={styles.label} style={{ marginLeft: 8, fontSize: '0.85em', opacity: 0.7 }}>{invite.label}</span>}
              </div>
              <div data-label="Server" className={styles.serverType}>
                {invite.server ? (
                  <>
                    <span className={styles.serverIcon}>
                      {invite.server.type === 'plex' ? (
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h4v16H4V4zm6 0h4v16h-4V4zm6 0h4v16h-4V4z" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5L19 8l-7 3.5L5 8l7-3.5zM4 9.5l7 3.5v7l-7-3.5v-7zm9 10.5v-7l7-3.5v7l-7 3.5z" /></svg>
                      )}
                    </span>
                    {invite.server.name}
                  </>
                ) : '-'}
              </div>
              <div data-label="Uses" className={styles.uses}>
                {invite.maxUses === 0 ? `${invite.uses} / ∞` : `${invite.uses} / ${invite.maxUses}`}
              </div>
              <div data-label="Access" className={styles.access}>
                {invite.accessDurationDays > 0 ? (
                  <span title={invite.autoRemove ? "Auto-remove when expired" : ""}>
                    {invite.accessDurationDays} day{invite.accessDurationDays !== 1 ? 's' : ''}
                    {invite.autoRemove && <span className={styles.autoRemove}> ↺</span>}
                  </span>
                ) : (
                  <span className={styles.permanent}>Permanent</span>
                )}
              </div>
              <div data-label="Status"><StatusBadge status={invite.status} /></div>
              <div data-label="Actions" className={styles.actions}>
                <button className={styles.actionButton} onClick={() => copyInviteLink(invite.code)} title="Copy invite link">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </button>
                <button className={styles.actionButton} onClick={() => copyInviteCode(invite.code)} title="Copy code">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                <button className={styles.actionButton} onClick={() => openEditModal(invite)} title="Edit invite">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button className={`${styles.actionButton} ${styles.danger}`} onClick={() => handleDeleteInvite(invite.id)} title="Delete invite">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <CreateInviteModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        form={newInvite}
        setForm={setNewInvite}
        maxUsesInput={maxUsesInput}
        setMaxUsesInput={setMaxUsesInput}
        expiresInput={expiresInput}
        setExpiresInput={setExpiresInput}
        accessInput={accessInput}
        setAccessInput={setAccessInput}
        servers={servers}
        libraries={libraries}
        profiles={profiles}
        selectedProfile={selectedProfile}
        onApplyProfile={applyProfile}
        onSaveProfile={saveCurrentAsProfile}
        creating={creating}
        onSubmit={handleCreateInvite}
      />

      <EditInviteModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        inviteCode={editingInvite?.code || ''}
        form={editForm}
        setForm={setEditForm}
        libraries={libraries}
        saving={saving}
        onSubmit={handleEditInvite}
      />
    </div>
  );
}
