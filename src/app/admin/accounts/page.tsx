'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, Input, Modal } from '@/components';
import { useToast } from '@/hooks/useToast';
import styles from './page.module.css';

interface AdminAccount {
  id: string;
  username: string;
  source: string;
  totpEnabled: boolean;
  createdAt: string;
}

export default function AccountsPage() {
  const { success, error: toastError } = useToast();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [form, setForm] = useState({ username: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [isLocalAdmin, setIsLocalAdmin] = useState(false);

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/accounts');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAdmins(data.admins);
      setCurrentAdminId(data.currentAdminId);
      setIsLocalAdmin(data.isLocalAdmin);
    } catch {
      toastError('Failed to load admin accounts');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const openCreate = () => {
    setEditing(null);
    setForm({ username: '', password: '' });
    setModalOpen(true);
  };

  const openEdit = (admin: AdminAccount) => {
    setEditing(admin);
    setForm({ username: admin.username, password: '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim()) {
      toastError('Username is required');
      return;
    }
    if (!editing && !form.password) {
      toastError('Password is required for new accounts');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const body: Record<string, string> = {};
        if (form.username !== editing.username) body.username = form.username;
        if (form.password) body.password = form.password;

        if (Object.keys(body).length === 0) {
          setModalOpen(false);
          return;
        }

        const res = await fetch(`/api/admin/accounts/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to update');
        }
        success('Admin account updated');
      } else {
        const res = await fetch('/api/admin/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: form.username, password: form.password }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to create');
        }
        success('Admin account created');
      }
      setModalOpen(false);
      fetchAdmins();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (admin: AdminAccount) => {
    if (!confirm(`Delete admin "${admin.username}"? This will revoke all their sessions.`)) return;

    try {
      const res = await fetch(`/api/admin/accounts/${admin.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete');
      }
      success('Admin account deleted');
      fetchAdmins();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Admin accounts</h1>
          <div className="adm-sub">Manage who has access to the admin dashboard.</div>
        </div>
        <div className="adm-page-actions">
          {isLocalAdmin && (
            <button type="button" className="adm-btn adm-btn-primary" onClick={openCreate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add admin
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : admins.length === 0 ? (
        <div className={styles.empty}>No admin accounts found.</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Username</th>
                <th>Source</th>
                <th>2FA</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td>
                    <span className={styles.username}>{admin.username}</span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeLocal}`}>
                      {admin.source || 'local'}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${admin.totpEnabled ? styles.badgeEnabled : styles.badgeDisabled}`}>
                      {admin.totpEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className={styles.date}>{formatDate(admin.createdAt)}</td>
                  <td>
                    <div className={styles.actions}>
                      {isLocalAdmin && (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(admin)}>
                          Edit
                        </Button>
                      )}
                      {isLocalAdmin && admin.id !== currentAdminId && (
                        <Button size="sm" variant="danger" onClick={() => handleDelete(admin)}>
                          Delete
                        </Button>
                      )}
                      {admin.id === currentAdminId && (
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>You</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Admin' : 'Add Admin'}
      >
        <div className={styles.modalForm}>
          <Input
            label="Username"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="admin_username"
          />
          <Input
            label={editing ? 'New Password (leave blank to keep current)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder={editing ? '••••••••' : 'Min 8 characters'}
          />
          <Button onClick={handleSave} loading={saving}>
            {editing ? 'Update' : 'Create'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
