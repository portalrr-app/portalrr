'use client';

import { Button, Modal, Input } from '@/components';
import styles from './page.module.css';

interface Server {
  id: string;
  name: string;
  type: 'plex' | 'jellyfin';
  url: string;
  isActive: boolean;
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

// --- Shared library toggle helper ---
function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter(i => i !== id) : [...list, id];
}

// --- Create Modal ---

export interface CreateInviteForm {
  serverId: string;
  maxUses: number;
  expiresInDays: number;
  accessDurationDays: number;
  autoRemove: boolean;
  libraries: string[];
  codeType: 'random' | 'pin' | 'custom';
  pinLength: number;
  customCode: string;
  label: string;
  passphrase: string;
  notifyOnUse: boolean;
  notifyOnExpiry: boolean;
}

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: CreateInviteForm;
  setForm: React.Dispatch<React.SetStateAction<CreateInviteForm>>;
  maxUsesInput: string;
  setMaxUsesInput: (v: string) => void;
  expiresInput: string;
  setExpiresInput: (v: string) => void;
  accessInput: string;
  setAccessInput: (v: string) => void;
  servers: Server[];
  libraries: Library[];
  profiles: InviteProfile[];
  selectedProfile: string;
  onApplyProfile: (name: string) => void;
  onSaveProfile: () => void;
  creating: boolean;
  onSubmit: () => void;
}

export function CreateInviteModal({
  isOpen, onClose, form, setForm,
  maxUsesInput, setMaxUsesInput, expiresInput, setExpiresInput,
  accessInput, setAccessInput, servers, libraries, profiles,
  selectedProfile, onApplyProfile, onSaveProfile, creating, onSubmit,
}: CreateModalProps) {
  const toggleLibrary = (libId: string) => {
    setForm(prev => ({ ...prev, libraries: toggleInList(prev.libraries, libId) }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Invite" description="Generate a new invite code for a user" size="lg">
      <div className={styles.createModal}>
        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>Profiles</h4>
          <div className={styles.formRow}>
            <select className={styles.serverSelect} value={selectedProfile} onChange={(e) => onApplyProfile(e.target.value)}>
              <option value="">Apply profile</option>
              {profiles.map((profile) => (
                <option key={profile.name} value={profile.name}>{profile.name}</option>
              ))}
            </select>
            <Button variant="secondary" onClick={onSaveProfile}>Save Current as Profile</Button>
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>Server</h4>
          <select className={styles.serverSelect} value={form.serverId} onChange={(e) => setForm(prev => ({ ...prev, serverId: e.target.value }))}>
            {servers.map((server) => (
              <option key={server.id} value={server.id}>{server.name} ({server.type})</option>
            ))}
          </select>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>Code Type</h4>
          <div className={styles.formRow}>
            <div>
              <label className={styles.label}>Code Type</label>
              <select className={styles.serverSelect} value={form.codeType} onChange={(e) => setForm(prev => ({ ...prev, codeType: e.target.value as 'random' | 'pin' | 'custom' }))}>
                <option value="random">Random</option>
                <option value="pin">PIN (numeric)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {form.codeType === 'pin' && (
              <div>
                <label className={styles.label}>PIN Length</label>
                <select className={styles.serverSelect} value={form.pinLength} onChange={(e) => setForm(prev => ({ ...prev, pinLength: parseInt(e.target.value) }))}>
                  {[4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n} digits</option>
                  ))}
                </select>
              </div>
            )}
            {form.codeType === 'custom' && (
              <div>
                <label className={styles.label}>Custom Code</label>
                <Input type="text" value={form.customCode} onChange={(e) => setForm(prev => ({ ...prev, customCode: e.target.value }))} hint="Letters, numbers, dashes, underscores (3-20 chars)" />
              </div>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>Invite Settings</h4>
          <div className={styles.formRow}>
            <div>
              <label className={styles.label}>Max Uses</label>
              <Input
                type="text" inputMode="numeric" value={maxUsesInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setMaxUsesInput(val);
                  setForm((prev) => ({ ...prev, maxUses: val === '' ? 0 : parseInt(val) }));
                }}
                onBlur={() => { if (maxUsesInput === '') setMaxUsesInput('0'); }}
                hint="0 = unlimited uses"
              />
            </div>
            <div>
              <label className={styles.label}>Expires In (Days)</label>
              <Input
                type="text" inputMode="numeric" value={expiresInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setExpiresInput(val);
                  setForm((prev) => ({ ...prev, expiresInDays: val === '' ? 0 : parseInt(val) }));
                }}
                onBlur={() => { if (expiresInput === '') setExpiresInput('0'); }}
                hint="0 = never expires"
              />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>Account Access Duration</h4>
          <div className={styles.formRow}>
            <div>
              <label className={styles.label}>Access Duration (Days)</label>
              <Input
                type="text" inputMode="numeric" value={accessInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setAccessInput(val);
                  setForm((prev) => ({ ...prev, accessDurationDays: val === '' ? 0 : parseInt(val) }));
                }}
                onBlur={() => { if (accessInput === '') setAccessInput('0'); }}
                hint="0 = permanent access"
              />
            </div>
            <div className={styles.checkboxWrapper}>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={form.autoRemove} onChange={(e) => setForm(prev => ({ ...prev, autoRemove: e.target.checked }))} />
                <span className={styles.checkboxLabel}>Auto-remove account when access expires</span>
              </label>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>Additional Options</h4>
          <div className={styles.formRow}>
            <div>
              <label className={styles.label}>Label</label>
              <Input type="text" value={form.label} onChange={(e) => setForm(prev => ({ ...prev, label: e.target.value }))} hint="Optional tag for organizing invites" />
            </div>
            <div>
              <label className={styles.label}>Passphrase</label>
              <Input type="text" value={form.passphrase} onChange={(e) => setForm(prev => ({ ...prev, passphrase: e.target.value }))} hint="Users must enter this to redeem the invite" />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.checkboxWrapper}>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={form.notifyOnUse} onChange={(e) => setForm(prev => ({ ...prev, notifyOnUse: e.target.checked }))} />
                <span className={styles.checkboxLabel}>Notify on use</span>
              </label>
            </div>
            <div className={styles.checkboxWrapper}>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={form.notifyOnExpiry} onChange={(e) => setForm(prev => ({ ...prev, notifyOnExpiry: e.target.checked }))} />
                <span className={styles.checkboxLabel}>Notify on expiry</span>
              </label>
            </div>
          </div>
        </div>

        {libraries.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionLabel}>Library Access</h4>
            <p className={styles.hint}>Select which libraries this invite grants access to. Leave empty for all.</p>
            <div className={styles.libraryGrid}>
              {libraries.map((lib) => (
                <label key={lib.id} className={styles.libraryItem}>
                  <input type="checkbox" checked={form.libraries.includes(lib.id)} onChange={() => toggleLibrary(lib.id)} />
                  <span>{lib.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth loading={creating} onClick={onSubmit}>Create Invite</Button>
        </div>
      </div>
    </Modal>
  );
}

// --- Edit Modal ---

export interface EditInviteForm {
  maxUses: string;
  expiresInDays: string;
  accessDurationDays: string;
  autoRemove: boolean;
  libraries: string[];
  label: string;
  passphrase: string;
  notifyOnUse: boolean;
  notifyOnExpiry: boolean;
}

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteCode: string;
  form: EditInviteForm;
  setForm: React.Dispatch<React.SetStateAction<EditInviteForm>>;
  libraries: Library[];
  saving: boolean;
  onSubmit: () => void;
}

export function EditInviteModal({
  isOpen, onClose, inviteCode, form, setForm, libraries, saving, onSubmit,
}: EditModalProps) {
  const toggleLibrary = (libId: string) => {
    setForm(prev => ({ ...prev, libraries: toggleInList(prev.libraries, libId) }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Invite" description={`Editing invite ${inviteCode}`} size="lg">
      <div className={styles.createModal}>
        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>Invite Settings</h4>
          <div className={styles.formRow}>
            <div>
              <label className={styles.label}>Max Uses</label>
              <Input
                type="text" inputMode="numeric" value={form.maxUses}
                onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ''); setForm(prev => ({ ...prev, maxUses: val })); }}
                hint="0 = unlimited uses"
              />
            </div>
            <div>
              <label className={styles.label}>New Expiry (Days from now)</label>
              <Input
                type="text" inputMode="numeric" value={form.expiresInDays}
                onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ''); setForm(prev => ({ ...prev, expiresInDays: val })); }}
                hint="Leave empty to keep current; 0 = never expires"
              />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>Account Access Duration</h4>
          <div className={styles.formRow}>
            <div>
              <label className={styles.label}>Access Duration (Days)</label>
              <Input
                type="text" inputMode="numeric" value={form.accessDurationDays}
                onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ''); setForm(prev => ({ ...prev, accessDurationDays: val })); }}
                hint="0 = permanent access"
              />
            </div>
            <div className={styles.checkboxWrapper}>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={form.autoRemove} onChange={(e) => setForm(prev => ({ ...prev, autoRemove: e.target.checked }))} />
                <span className={styles.checkboxLabel}>Auto-remove account when access expires</span>
              </label>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionLabel}>Additional Options</h4>
          <div className={styles.formRow}>
            <div>
              <label className={styles.label}>Label</label>
              <Input type="text" value={form.label} onChange={(e) => setForm(prev => ({ ...prev, label: e.target.value }))} hint="Optional tag for organizing invites" />
            </div>
            <div>
              <label className={styles.label}>Passphrase</label>
              <Input type="text" value={form.passphrase} onChange={(e) => setForm(prev => ({ ...prev, passphrase: e.target.value }))} hint="Leave empty to keep current; enter new value to change" />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.checkboxWrapper}>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={form.notifyOnUse} onChange={(e) => setForm(prev => ({ ...prev, notifyOnUse: e.target.checked }))} />
                <span className={styles.checkboxLabel}>Notify on use</span>
              </label>
            </div>
            <div className={styles.checkboxWrapper}>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={form.notifyOnExpiry} onChange={(e) => setForm(prev => ({ ...prev, notifyOnExpiry: e.target.checked }))} />
                <span className={styles.checkboxLabel}>Notify on expiry</span>
              </label>
            </div>
          </div>
        </div>

        {libraries.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionLabel}>Library Access</h4>
            <p className={styles.hint}>Select which libraries this invite grants access to. Leave empty for all.</p>
            <div className={styles.libraryGrid}>
              {libraries.map((lib) => (
                <label key={lib.id} className={styles.libraryItem}>
                  <input type="checkbox" checked={form.libraries.includes(lib.id)} onChange={() => toggleLibrary(lib.id)} />
                  <span>{lib.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth loading={saving} onClick={onSubmit}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}
