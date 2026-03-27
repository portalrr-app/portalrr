'use client';

import { Button, Input } from '@/components';
import { EmailTemplate, TemplateForm, Styles, TEMPLATE_TYPES } from './types';

interface EmailTemplatesTabProps {
  styles: Styles;
  templates: EmailTemplate[];
  templateVariables: Record<string, string[]>;
  templatesLoading: boolean;
  editingTemplate: string | null;
  setEditingTemplate: (eventType: string | null) => void;
  templateForm: TemplateForm;
  setTemplateForm: React.Dispatch<React.SetStateAction<TemplateForm>>;
  templateSaving: boolean;
  templatePreview: { subject: string; body: string } | null;
  setTemplatePreview: (preview: { subject: string; body: string } | null) => void;
  previewLoading: boolean;
  saveTemplate: () => void;
  resetTemplate: (eventType: string) => void;
  previewTemplate: () => void;
  toggleTemplateEnabled: (eventType: string, currentEnabled: boolean) => void;
  openEditTemplate: (tpl: EmailTemplate) => void;
}

export function EmailTemplatesTab({
  styles,
  templates,
  templateVariables,
  templatesLoading,
  editingTemplate,
  setEditingTemplate,
  templateForm,
  setTemplateForm,
  templateSaving,
  templatePreview,
  setTemplatePreview,
  previewLoading,
  saveTemplate,
  resetTemplate,
  previewTemplate,
  toggleTemplateEnabled,
  openEditTemplate,
}: EmailTemplatesTabProps) {
  return (
    <div>
      <div className={styles.sectionHeader}>
        <div>
          <div className={styles.sectionTitle}>Email Templates</div>
          <div className={styles.sectionDescription}>
            Customize the emails sent to users for different events.
          </div>
        </div>
      </div>

      {templatesLoading ? (
        <div className={styles.loading}>Loading templates...</div>
      ) : (
        <>
          <div className={styles.templateList}>
            {Object.entries(TEMPLATE_TYPES).map(([eventType, info]) => {
              const tpl = templates.find((t) => t.eventType === eventType);
              const isActive = editingTemplate === eventType;

              return (
                <div
                  key={eventType}
                  className={`${styles.templateCard} ${isActive ? styles.active : ''}`}
                  onClick={() => {
                    if (tpl) {
                      openEditTemplate(tpl);
                    } else {
                      setEditingTemplate(eventType);
                      setTemplateForm({ subject: '', body: '', enabled: true });
                      setTemplatePreview(null);
                    }
                  }}
                >
                  <div className={styles.templateIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                  <div className={styles.templateInfo}>
                    <div className={styles.templateName}>{info.label}</div>
                    <div className={styles.templateDesc}>{info.description}</div>
                  </div>
                  <div className={styles.templateActions}>
                    {tpl && !tpl.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetTemplate(eventType);
                        }}
                      >
                        Reset
                      </Button>
                    )}
                    <span
                      className={`${styles.enabledBadge} ${
                        tpl?.enabled !== false ? styles.on : styles.off
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (tpl) toggleTemplateEnabled(eventType, tpl.enabled);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {tpl?.enabled !== false ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Template Editor */}
          {editingTemplate && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                Editing: {TEMPLATE_TYPES[editingTemplate]?.label || editingTemplate}
              </div>

              {templateVariables[editingTemplate] && (
                <div>
                  <label className={styles.label} style={{ marginTop: 12 }}>
                    Available Variables
                  </label>
                  <div className={styles.variablesList}>
                    {templateVariables[editingTemplate].map((v) => (
                      <span key={v} className={styles.variableTag}>
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.formGrid} style={{ marginTop: 16 }}>
                <Input
                  label="Subject"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Welcome to {{appName}}"
                />

                <div>
                  <label className={styles.label}>Body (Markdown)</label>
                  <textarea
                    className={`${styles.textarea} ${styles.textareaLarge}`}
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, body: e.target.value }))}
                    placeholder="Hello {{username}},&#10;&#10;Welcome to our server..."
                  />
                </div>

                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={templateForm.enabled}
                    onChange={(e) =>
                      setTemplateForm((f) => ({ ...f, enabled: e.target.checked }))
                    }
                  />
                  Enabled
                </label>

                <div className={styles.modalActions}>
                  <Button onClick={saveTemplate} loading={templateSaving}>
                    Save Template
                  </Button>
                  <Button variant="secondary" onClick={previewTemplate} loading={previewLoading}>
                    Preview
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplatePreview(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>

              {templatePreview && (
                <div className={styles.previewBox}>
                  <div className={styles.previewSubject}>{templatePreview.subject}</div>
                  <div className={styles.previewBody}>{templatePreview.body}</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
