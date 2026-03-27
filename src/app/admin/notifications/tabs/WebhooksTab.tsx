'use client';

import { Button, Input, Modal } from '@/components';
import { Webhook, WebhookForm, Styles, WEBHOOK_EVENTS, maskUrl } from './types';

interface WebhooksTabProps {
  styles: Styles;
  webhooks: Webhook[];
  webhooksLoading: boolean;
  webhookModalOpen: boolean;
  setWebhookModalOpen: (open: boolean) => void;
  editingWebhook: Webhook | null;
  webhookForm: WebhookForm;
  setWebhookForm: React.Dispatch<React.SetStateAction<WebhookForm>>;
  webhookSaving: boolean;
  testingWebhook: string | null;
  testResults: Record<string, { success: boolean; message: string }>;
  saveWebhook: () => void;
  deleteWebhook: (id: string) => void;
  testWebhook: (id: string) => void;
  toggleWebhookEnabled: (webhook: Webhook) => void;
  resetWebhookForm: () => void;
  openEditWebhook: (wh: Webhook) => void;
}

export function WebhooksTab({
  styles,
  webhooks,
  webhooksLoading,
  webhookModalOpen,
  setWebhookModalOpen,
  editingWebhook,
  webhookForm,
  setWebhookForm,
  webhookSaving,
  testingWebhook,
  testResults,
  saveWebhook,
  deleteWebhook,
  testWebhook,
  toggleWebhookEnabled,
  resetWebhookForm,
  openEditWebhook,
}: WebhooksTabProps) {
  return (
    <div>
      <div className={styles.sectionHeader}>
        <div>
          <div className={styles.sectionTitle}>Webhook Endpoints</div>
          <div className={styles.sectionDescription}>
            Send real-time notifications to external services when events occur.
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => {
            resetWebhookForm();
            setWebhookModalOpen(true);
          }}
        >
          Add Webhook
        </Button>
      </div>

      {webhooksLoading ? (
        <div className={styles.loading}>Loading webhooks...</div>
      ) : webhooks.length === 0 ? (
        <div className={styles.emptyState}>No webhooks configured yet.</div>
      ) : (
        <div className={styles.webhookList}>
          {webhooks.map((wh) => (
            <div key={wh.id} className={styles.webhookCard}>
              <div className={styles.webhookIcon}>
                {wh.type === 'discord' ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                )}
              </div>

              <div className={styles.webhookInfo}>
                <div className={styles.webhookName}>{wh.name}</div>
                <div className={styles.webhookMeta}>
                  <span className={styles.webhookType}>{wh.type}</span>
                  <span className={styles.webhookUrl}>{maskUrl(wh.url)}</span>
                  <span className={styles.webhookEvents}>
                    {wh.events.length} event{wh.events.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {testResults[wh.id] && (
                  <div
                    className={`${styles.testResult} ${
                      testResults[wh.id].success ? styles.success : styles.error
                    }`}
                  >
                    {testResults[wh.id].message}
                  </div>
                )}
              </div>

              <span
                className={`${styles.enabledBadge} ${wh.enabled ? styles.on : styles.off}`}
                onClick={() => toggleWebhookEnabled(wh)}
                style={{ cursor: 'pointer' }}
              >
                {wh.enabled ? 'Enabled' : 'Disabled'}
              </span>

              <div className={styles.webhookActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testWebhook(wh.id)}
                  loading={testingWebhook === wh.id}
                >
                  Test
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEditWebhook(wh)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteWebhook(wh.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Webhook Modal */}
      <Modal
        isOpen={webhookModalOpen}
        onClose={() => {
          setWebhookModalOpen(false);
          resetWebhookForm();
        }}
        title={editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
        size="lg"
      >
        <div className={styles.formGrid}>
          <div className={styles.twoColGrid}>
            <Input
              label="Name"
              value={webhookForm.name}
              onChange={(e) => setWebhookForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="My Discord Webhook"
            />
            <div>
              <label className={styles.label}>Type</label>
              <select
                className={styles.select}
                value={webhookForm.type}
                onChange={(e) =>
                  setWebhookForm((f) => ({
                    ...f,
                    type: e.target.value as 'discord' | 'generic',
                  }))
                }
              >
                <option value="discord">Discord</option>
                <option value="generic">Generic (HTTP)</option>
              </select>
            </div>
          </div>

          <Input
            label="URL"
            value={webhookForm.url}
            onChange={(e) => setWebhookForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://discord.com/api/webhooks/..."
          />

          {webhookForm.type === 'generic' && (
            <>
              <Input
                label="Secret (HMAC signing)"
                type="password"
                value={webhookForm.secret}
                onChange={(e) => setWebhookForm((f) => ({ ...f, secret: e.target.value }))}
                placeholder={editingWebhook?.hasSecret ? 'Leave blank to keep existing' : 'Optional'}
              />
              <div>
                <label className={styles.label}>Custom Template (JSON)</label>
                <textarea
                  className={`${styles.textarea} ${styles.textareaLarge}`}
                  value={webhookForm.template}
                  onChange={(e) => setWebhookForm((f) => ({ ...f, template: e.target.value }))}
                  placeholder={'{\n  "event": "{{event}}",\n  "user": "{{username}}",\n  "timestamp": "{{timestamp}}"\n}'}
                />
              </div>
            </>
          )}

          <div>
            <label className={styles.label}>Events</label>
            <div className={styles.eventGrid}>
              {WEBHOOK_EVENTS.map((event) => (
                <label key={event} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={webhookForm.events.includes(event)}
                    onChange={(e) => {
                      setWebhookForm((f) => ({
                        ...f,
                        events: e.target.checked
                          ? [...f.events, event]
                          : f.events.filter((ev) => ev !== event),
                      }));
                    }}
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>

          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={webhookForm.enabled}
              onChange={(e) => setWebhookForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Enabled
          </label>

          <div className={styles.modalActions}>
            <Button onClick={saveWebhook} loading={webhookSaving}>
              {editingWebhook ? 'Save Changes' : 'Create Webhook'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setWebhookModalOpen(false);
                resetWebhookForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
