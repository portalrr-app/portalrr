'use client';

import { useEffect, useMemo, useState } from 'react';
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

  const counts = useMemo(() => {
    const active = invites.filter((i) => i.status === 'active').length;
    const used = invites.filter((i) => i.status === 'used').length;
    const expired = invites.filter((i) => i.status === 'expired' || i.status === 'cancelled').length;
    const expiring = invites.filter((i) => {
      if (i.status !== 'active' || !i.expiresAt) return false;
      const ms = new Date(i.expiresAt).getTime() - Date.now();
      return ms > 0 && ms < 24 * 60 * 60 * 1000;
    }).length;
    return { active, used, expired, expiring };
  }, [invites]);

  const filters: { value: FilterType; label: string; count: number; dot: string }[] = [
    { value: 'all', label: 'All', count: invites.length, dot: 'var(--text-tertiary)' },
    { value: 'active', label: 'Active', count: counts.active, dot: 'var(--success)' },
    { value: 'used', label: 'Used', count: counts.used, dot: 'var(--text-tertiary)' },
    { value: 'expired', label: 'Expired', count: counts.expired, dot: 'var(--error)' },
  ];

  const [search, setSearch] = useState('');

  // Hydrate from URL (?q=) so the top-bar search on any page lands here
  // with the right filter applied.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URL(window.location.href).searchParams.get('q') || '';
    setSearch(q);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const visibleInvites = useMemo(() => {
    if (!search) return invites;
    const q = search.toLowerCase();
    return invites.filter(
      (i) =>
        i.code.toLowerCase().includes(q) ||
        (i.label || '').toLowerCase().includes(q) ||
        (i.email || '').toLowerCase().includes(q),
    );
  }, [invites, search]);

  const topLabels = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of invites) {
      if (!i.label) continue;
      map.set(i.label, (map.get(i.label) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [invites]);

  const conversionPct = (() => {
    const denom = counts.used + counts.expired;
    if (denom === 0) return null;
    return Math.round((counts.used / denom) * 100);
  })();

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Invites</h1>
          <div className="adm-sub">
            Generate and manage invite codes.
            {counts.active > 0 && (
              <>
                {' '}<b style={{ color: 'var(--text-primary)' }}>{counts.active} active</b>
                {counts.expiring > 0 && <> · {counts.expiring} expiring in 24h</>}
              </>
            )}
          </div>
        </div>
        <div className="adm-page-actions">
          <button
            className="adm-btn adm-btn-primary"
            onClick={() => servers.length > 0 && setIsCreateModalOpen(true)}
            disabled={servers.length === 0}
            title={servers.length === 0 ? 'Add a server in Settings first' : ''}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New invite
          </button>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelMain}>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                placeholder="Filter by code, email, label…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className={styles.chipRow}>
              {filters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`${styles.chip} ${filter === f.value ? styles.chipOn : ''}`}
                  onClick={() => setFilter(f.value)}
                >
                  <span className={styles.chipDot} style={{ color: f.dot }} />
                  {f.label}
                  {f.count > 0 && <span className={styles.chipCount}>· {f.count}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className={`adm-card ${styles.tableCard}`}>
            <div className={styles.tblHd}>
              <span>Code · label</span>
              <span className={styles.hideSm}>Recipient</span>
              <span className={styles.hideSm}>Expires</span>
              <span className={styles.hideSm}>Usage</span>
              <span>Status</span>
              <span />
            </div>

            {loading ? (
              <div className={styles.emptyState}><p>Loading…</p></div>
            ) : visibleInvites.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>
                  {invites.length === 0 ? 'No invites found' : 'No matches'}
                </p>
                <p>{invites.length === 0 ? 'Create your first invite to get started.' : 'Try a different search or filter.'}</p>
                {invites.length === 0 && (
                  <Button
                    onClick={() => servers.length > 0 && setIsCreateModalOpen(true)}
                    disabled={servers.length === 0}
                  >
                    Create invite
                  </Button>
                )}
              </div>
            ) : (
              visibleInvites.map((invite) => (
                <div key={invite.id} className={styles.tblRow}>
                  <div className={styles.codeCell}>
                    <span className="adm-code" title={invite.code}>{invite.code}</span>
                    <div className={styles.codeMeta}>
                      <span className={styles.codeLabel}>
                        {invite.label || (invite.email || '—')}
                      </span>
                      <span className={styles.codeSub}>
                        {invite.server?.name || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                  <div className={`${styles.hideSm} ${styles.mono}`}>
                    {invite.email || '—'}
                  </div>
                  <div className={`${styles.hideSm} ${styles.mono} ${styles.expires}`}>
                    {formatExpiry(invite)}
                  </div>
                  <div className={`${styles.hideSm} ${styles.usage}`}>
                    <div className={styles.usageMeter}>
                      <i
                        style={{
                          width: invite.maxUses === 0
                            ? '0%'
                            : `${Math.min(100, (invite.uses / invite.maxUses) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className={styles.usageN}>
                      {invite.uses}/{invite.maxUses === 0 ? '∞' : invite.maxUses}
                    </span>
                  </div>
                  <div><StatusBadge status={invite.status} /></div>
                  <div className={styles.rowActions}>
                    <button onClick={() => copyInviteLink(invite.code)} title="Copy invite link">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    </button>
                    <button onClick={() => copyInviteCode(invite.code)} title="Copy code">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                    <button onClick={() => openEditModal(invite)} title="Edit invite">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className={styles.rowActionDanger}
                      onClick={() => handleDeleteInvite(invite.id)}
                      title="Delete invite"
                    >
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
        </div>

        <aside className={styles.sideStats}>
          <div className={styles.statTile}>
            <div className={styles.statLbl}>Conversion</div>
            <div className={styles.statVal}>{conversionPct === null ? '—' : `${conversionPct}%`}</div>
            <div className={styles.statDetail}>
              <span>Redeemed <b>{counts.used}</b></span>
              <span>·</span>
              <span>Expired <b>{counts.expired}</b></span>
            </div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.statLbl}>Active invites</div>
            <div className={styles.statVal}>{counts.active}</div>
            <div className={styles.statDetail}>
              <span>Expiring soon <b>{counts.expiring}</b></span>
            </div>
          </div>
          <div className="adm-card">
            <div className="adm-card-head">
              <h3>Top labels</h3>
            </div>
            <div className="adm-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topLabels.length === 0 ? (
                <div className={styles.emptyMini}>No labels yet.</div>
              ) : (
                topLabels.map(([label, n], i) => (
                  <div key={label} className={styles.labelRow}>
                    <span className={styles.labelDot} style={{ background: LABEL_COLORS[i] }} />
                    <span className={styles.labelText}>{label}</span>
                    <span className={styles.labelCount}>{n}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
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

const LABEL_COLORS = ['#A78BFA', '#60A5FA', '#34D399', '#FBBF24', '#F87171'];

function formatExpiry(invite: { expiresAt: string | null; accessDurationDays: number; status: string }) {
  if (invite.status === 'expired') return 'Expired';
  if (!invite.expiresAt) {
    if (invite.accessDurationDays > 0) {
      return `${invite.accessDurationDays}d after use`;
    }
    return 'No expiry';
  }
  const d = new Date(invite.expiresAt);
  const now = new Date();
  const ms = d.getTime() - now.getTime();
  if (ms <= 0) return 'Expired';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const hours = Math.floor(ms / (60 * 60 * 1000));
  return `in ${hours}h`;
}
