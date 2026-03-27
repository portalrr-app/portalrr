'use client';

import { Button, Input } from '@/components';
import { Announcement, AnnouncementForm, Styles, formatDate } from './types';

interface AnnouncementsTabProps {
  styles: Styles;
  announcements: Announcement[];
  announcementsLoading: boolean;
  announcementForm: AnnouncementForm;
  setAnnouncementForm: React.Dispatch<React.SetStateAction<AnnouncementForm>>;
  announcementSending: boolean;
  showAnnouncementForm: boolean;
  setShowAnnouncementForm: (show: boolean) => void;
  sendAnnouncement: () => void;
}

export function AnnouncementsTab({
  styles,
  announcements,
  announcementsLoading,
  announcementForm,
  setAnnouncementForm,
  announcementSending,
  showAnnouncementForm,
  setShowAnnouncementForm,
  sendAnnouncement,
}: AnnouncementsTabProps) {
  return (
    <div>
      <div className={styles.sectionHeader}>
        <div>
          <div className={styles.sectionTitle}>Announcements</div>
          <div className={styles.sectionDescription}>
            Send messages to your users via email and webhooks.
          </div>
        </div>
        <Button size="sm" onClick={() => setShowAnnouncementForm(!showAnnouncementForm)}>
          {showAnnouncementForm ? 'Cancel' : 'New Announcement'}
        </Button>
      </div>

      {/* New Announcement Form */}
      {showAnnouncementForm && (
        <div className={styles.section} style={{ marginBottom: 20 }}>
          <div className={styles.sectionTitle}>New Announcement</div>
          <div className={styles.formGrid} style={{ marginTop: 12 }}>
            <Input
              label="Title"
              value={announcementForm.title}
              onChange={(e) =>
                setAnnouncementForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="Server Maintenance Notice"
            />

            <div>
              <label className={styles.label}>Body (Markdown)</label>
              <textarea
                className={`${styles.textarea} ${styles.textareaLarge}`}
                value={announcementForm.body}
                onChange={(e) =>
                  setAnnouncementForm((f) => ({ ...f, body: e.target.value }))
                }
                placeholder="We will be performing scheduled maintenance..."
              />
            </div>

            <div className={styles.twoColGrid}>
              <div>
                <label className={styles.label}>Send To</label>
                <select
                  className={styles.select}
                  value={announcementForm.sentTo}
                  onChange={(e) =>
                    setAnnouncementForm((f) => ({ ...f, sentTo: e.target.value }))
                  }
                >
                  <option value="all">All Users</option>
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  You can also enter a JSON array of label names, e.g. [&quot;vip&quot;,&quot;beta&quot;]
                </div>
              </div>
              <div>
                <label className={styles.label}>Send Via</label>
                <div className={styles.toggleRow}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={announcementForm.sendVia.includes('email')}
                      onChange={(e) => {
                        setAnnouncementForm((f) => ({
                          ...f,
                          sendVia: e.target.checked
                            ? [...f.sendVia, 'email']
                            : f.sendVia.filter((v) => v !== 'email'),
                        }));
                      }}
                    />
                    Email
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={announcementForm.sendVia.includes('webhook')}
                      onChange={(e) => {
                        setAnnouncementForm((f) => ({
                          ...f,
                          sendVia: e.target.checked
                            ? [...f.sendVia, 'webhook']
                            : f.sendVia.filter((v) => v !== 'webhook'),
                        }));
                      }}
                    />
                    Webhook
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={announcementForm.sendVia.includes('discord')}
                      onChange={(e) => {
                        setAnnouncementForm((f) => ({
                          ...f,
                          sendVia: e.target.checked
                            ? [...f.sendVia, 'discord']
                            : f.sendVia.filter((v) => v !== 'discord'),
                        }));
                      }}
                    />
                    Discord
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={announcementForm.sendVia.includes('telegram')}
                      onChange={(e) => {
                        setAnnouncementForm((f) => ({
                          ...f,
                          sendVia: e.target.checked
                            ? [...f.sendVia, 'telegram']
                            : f.sendVia.filter((v) => v !== 'telegram'),
                        }));
                      }}
                    />
                    Telegram
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <Button onClick={sendAnnouncement} loading={announcementSending}>
                Send Announcement
              </Button>
              <Button variant="secondary" onClick={() => setShowAnnouncementForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Past Announcements */}
      {announcementsLoading ? (
        <div className={styles.loading}>Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <div className={styles.emptyState}>No announcements have been sent yet.</div>
      ) : (
        <div className={styles.announcementList}>
          {announcements.map((a) => {
            let viaList: string[] = [];
            try {
              viaList = JSON.parse(a.sentVia);
            } catch {
              viaList = [a.sentVia];
            }

            return (
              <div key={a.id} className={styles.announcementCard}>
                <div className={styles.announcementHeader}>
                  <div className={styles.announcementTitle}>{a.title}</div>
                  <div className={styles.announcementDate}>{formatDate(a.createdAt)}</div>
                </div>
                <div className={styles.announcementBody}>{a.body}</div>
                <div className={styles.announcementMeta}>
                  <span className={styles.announcementMetaItem}>
                    Sent by: {a.sentBy}
                  </span>
                  <span className={styles.announcementMetaItem}>
                    To: {a.sentTo === 'all' ? 'All users' : a.sentTo}
                  </span>
                  <span className={styles.announcementMetaItem}>
                    Via: {viaList.join(', ')}
                  </span>
                  <span className={styles.announcementMetaItem}>
                    Delivered: {a.sentCount}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
