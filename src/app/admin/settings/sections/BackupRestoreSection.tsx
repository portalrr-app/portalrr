'use client';

import React from 'react';
import { Button, Modal } from '@/components';

interface BackupSection {
  key: string;
  label: string;
}

interface BackupRestoreSectionProps {
  styles: Record<string, string>;
  exporting: boolean;
  importing: boolean;
  showRestoreModal: boolean;
  setShowRestoreModal: (show: boolean) => void;
  restoreFile: File | null;
  setRestoreFile: (file: File | null) => void;
  restoreMode: 'merge' | 'replace';
  setRestoreMode: (mode: 'merge' | 'replace') => void;
  restoreSections: string[];
  toggleRestoreSection: (key: string) => void;
  backupSections: readonly BackupSection[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onExportBackup: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRestore: () => void;
}

export default function BackupRestoreSection({
  styles,
  exporting,
  importing,
  showRestoreModal,
  setShowRestoreModal,
  restoreFile,
  setRestoreFile,
  restoreMode,
  setRestoreMode,
  restoreSections,
  toggleRestoreSection,
  backupSections,
  fileInputRef,
  onExportBackup,
  onFileSelect,
  onRestore,
}: BackupRestoreSectionProps) {
  return (
    <>
      <div className={`${styles.section} ${styles.spanFull}`}>
        <h2 className={styles.sectionTitle}>Backup & Restore</h2>
        <p className={styles.sectionDescription}>Export your configuration and data, or restore from a previous backup</p>
        <div className={styles.backupActions}>
          <div className={styles.backupCard}>
            <div className={styles.backupCardIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div className={styles.backupCardInfo}>
              <div className={styles.backupCardTitle}>Export Backup</div>
              <div className={styles.backupCardDesc}>
                Download a JSON file containing your settings, invites, users, webhooks, email templates, and announcements. Secrets and passwords are excluded.
              </div>
            </div>
            <div className={styles.backupCardAction}>
              <Button size="sm" onClick={onExportBackup} loading={exporting}>Export Backup</Button>
            </div>
          </div>
          <div className={styles.backupCard}>
            <div className={styles.backupCardIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className={styles.backupCardInfo}>
              <div className={styles.backupCardTitle}>Import Backup</div>
              <div className={styles.backupCardDesc}>
                Restore data from a previously exported backup file. You can choose which sections to import and whether to merge or replace existing data.
              </div>
            </div>
            <div className={styles.backupCardAction}>
              <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>Import Backup</Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={onFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Restore Backup Modal */}
      <Modal
        isOpen={showRestoreModal}
        onClose={() => { setShowRestoreModal(false); setRestoreFile(null); }}
        title="Import Backup"
        description="Choose which sections to restore and how to handle existing data"
        size="md"
      >
        <div className={styles.restoreModal}>
          {restoreFile && (
            <div className={styles.restoreFileInfo}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>{restoreFile.name}</span>
            </div>
          )}

          <div className={styles.restoreSection}>
            <label className={styles.label}>Import Mode</label>
            <div className={styles.restoreModeOptions}>
              <button
                type="button"
                className={`${styles.restoreModeOption} ${restoreMode === 'merge' ? styles.selected : ''}`}
                onClick={() => setRestoreMode('merge')}
              >
                <strong>Merge</strong>
                <span>Add missing records, skip existing ones</span>
              </button>
              <button
                type="button"
                className={`${styles.restoreModeOption} ${restoreMode === 'replace' ? styles.selected : ''}`}
                onClick={() => setRestoreMode('replace')}
              >
                <strong>Replace</strong>
                <span>Wipe and replace selected sections</span>
              </button>
            </div>
          </div>

          <div className={styles.restoreSection}>
            <label className={styles.label}>Sections to Import</label>
            <div className={styles.restoreSectionsList}>
              {backupSections.map(({ key, label }) => (
                <label key={key} className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={restoreSections.includes(key)}
                    onChange={() => toggleRestoreSection(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {restoreMode === 'replace' && (
            <div className={styles.restoreWarning}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Replace mode will permanently delete all existing data in the selected sections before importing. This cannot be undone.</span>
            </div>
          )}

          <div className={styles.modalActions}>
            <Button variant="secondary" fullWidth onClick={() => { setShowRestoreModal(false); setRestoreFile(null); }}>Cancel</Button>
            <Button
              fullWidth
              variant={restoreMode === 'replace' ? 'danger' : 'primary'}
              onClick={onRestore}
              loading={importing}
              disabled={restoreSections.length === 0}
            >
              {restoreMode === 'replace' ? 'Replace & Import' : 'Merge & Import'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
