'use client';

import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import styles from './page.module.css';
import { WebhooksTab, EmailTemplatesTab, AnnouncementsTab } from './tabs';
import type { Webhook, EmailTemplate, Announcement, Tab, WebhookForm, TemplateForm, AnnouncementForm } from './tabs';

// ─── Component ───────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('webhooks');

  // Webhooks state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [webhookForm, setWebhookForm] = useState<WebhookForm>({
    name: '',
    url: '',
    type: 'discord',
    events: [],
    enabled: true,
    secret: '',
    template: '',
  });
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Email templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string[]>>({});
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>({ subject: '', body: '', enabled: true });
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templatePreview, setTemplatePreview] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementForm>({
    title: '',
    body: '',
    sentTo: 'all',
    sendVia: ['email'],
  });
  const [announcementSending, setAnnouncementSending] = useState(false);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);

  // ─── Webhooks API ────────────────────────────────────────────────

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/webhooks');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setWebhooks(data);
    } catch {
      toastError('Failed to load webhooks');
    } finally {
      setWebhooksLoading(false);
    }
  }, [toastError]);

  const saveWebhook = async () => {
    setWebhookSaving(true);
    try {
      const payload = {
        name: webhookForm.name,
        url: webhookForm.url,
        type: webhookForm.type,
        events: webhookForm.events,
        enabled: webhookForm.enabled,
        secret: webhookForm.type === 'generic' && webhookForm.secret ? webhookForm.secret : undefined,
        template: webhookForm.type === 'generic' && webhookForm.template ? webhookForm.template : undefined,
      };

      let res: Response;
      if (editingWebhook) {
        res = await fetch(`/api/admin/webhooks/${editingWebhook.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/admin/webhooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save webhook');
      }

      success(editingWebhook ? 'Webhook updated' : 'Webhook created');
      setWebhookModalOpen(false);
      resetWebhookForm();
      fetchWebhooks();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save webhook');
    } finally {
      setWebhookSaving(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      const res = await fetch(`/api/admin/webhooks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      success('Webhook deleted');
      fetchWebhooks();
    } catch {
      toastError('Failed to delete webhook');
    }
  };

  const testWebhook = async (id: string) => {
    setTestingWebhook(id);
    try {
      const res = await fetch(`/api/admin/webhooks/${id}`, { method: 'POST' });
      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          success: data.success,
          message: data.success
            ? `OK (${data.status})`
            : data.message || `Failed (${data.status})`,
        },
      }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, message: 'Request failed' },
      }));
    } finally {
      setTestingWebhook(null);
    }
  };

  const toggleWebhookEnabled = async (webhook: Webhook) => {
    try {
      const res = await fetch(`/api/admin/webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !webhook.enabled }),
      });
      if (!res.ok) throw new Error('Failed to toggle');
      fetchWebhooks();
    } catch {
      toastError('Failed to toggle webhook');
    }
  };

  const resetWebhookForm = () => {
    setEditingWebhook(null);
    setWebhookForm({
      name: '',
      url: '',
      type: 'discord',
      events: [],
      enabled: true,
      secret: '',
      template: '',
    });
  };

  const openEditWebhook = (wh: Webhook) => {
    setEditingWebhook(wh);
    setWebhookForm({
      name: wh.name,
      url: wh.url,
      type: wh.type,
      events: wh.events,
      enabled: wh.enabled,
      secret: '',
      template: wh.template || '',
    });
    setWebhookModalOpen(true);
  };

  // ─── Email Templates API ────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/email-templates');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTemplates(data.templates || []);
      setTemplateVariables(data.variables || {});
    } catch {
      toastError('Failed to load email templates');
    } finally {
      setTemplatesLoading(false);
    }
  }, [toastError]);

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    setTemplateSaving(true);
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: editingTemplate,
          subject: templateForm.subject,
          body: templateForm.body,
          enabled: templateForm.enabled,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      success('Template saved');
      fetchTemplates();
    } catch {
      toastError('Failed to save template');
    } finally {
      setTemplateSaving(false);
    }
  };

  const resetTemplate = async (eventType: string) => {
    if (!confirm('Reset this template to its default? Any customizations will be lost.')) return;
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType }),
      });
      if (!res.ok) throw new Error('Failed to reset');
      success('Template reset to default');
      if (editingTemplate === eventType) {
        setEditingTemplate(null);
        setTemplatePreview(null);
      }
      fetchTemplates();
    } catch {
      toastError('Failed to reset template');
    }
  };

  const previewTemplate = async () => {
    if (!editingTemplate) return;
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/admin/email-templates?preview=true', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: editingTemplate,
          subject: templateForm.subject,
          body: templateForm.body,
        }),
      });
      if (!res.ok) throw new Error('Failed to preview');
      const data = await res.json();
      setTemplatePreview(data);
    } catch {
      toastError('Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleTemplateEnabled = async (eventType: string, currentEnabled: boolean) => {
    try {
      const tpl = templates.find((t) => t.eventType === eventType);
      if (!tpl) return;
      const res = await fetch('/api/admin/email-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          subject: tpl.subject,
          body: tpl.body,
          enabled: !currentEnabled,
        }),
      });
      if (!res.ok) throw new Error('Failed to toggle');
      fetchTemplates();
    } catch {
      toastError('Failed to toggle template');
    }
  };

  const openEditTemplate = (tpl: EmailTemplate) => {
    setEditingTemplate(tpl.eventType);
    setTemplateForm({
      subject: tpl.subject,
      body: tpl.body,
      enabled: tpl.enabled,
    });
    setTemplatePreview(null);
  };

  // ─── Announcements API ──────────────────────────────────────────

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/announcements');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch {
      toastError('Failed to load announcements');
    } finally {
      setAnnouncementsLoading(false);
    }
  }, [toastError]);

  const sendAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.body.trim()) {
      toastError('Title and body are required');
      return;
    }
    setAnnouncementSending(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcementForm),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to send');
      }
      success('Announcement sent');
      setAnnouncementForm({ title: '', body: '', sentTo: 'all', sendVia: ['email'] });
      setShowAnnouncementForm(false);
      fetchAnnouncements();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to send announcement');
    } finally {
      setAnnouncementSending(false);
    }
  };

  // ─── Effects ────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === 'webhooks') fetchWebhooks();
    if (activeTab === 'email-templates') fetchTemplates();
    if (activeTab === 'announcements') fetchAnnouncements();
  }, [activeTab, fetchWebhooks, fetchTemplates, fetchAnnouncements]);

  // ─── Main Render ────────────────────────────────────────────────

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Notifications</h1>
          <p className={styles.subtitle}>
            Manage webhooks, email templates, and announcements
          </p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'webhooks' ? styles.active : ''}`}
          onClick={() => setActiveTab('webhooks')}
        >
          Webhooks
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'email-templates' ? styles.active : ''}`}
          onClick={() => setActiveTab('email-templates')}
        >
          Email Templates
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'announcements' ? styles.active : ''}`}
          onClick={() => setActiveTab('announcements')}
        >
          Announcements
        </button>
      </div>

      <div className={styles.section}>
        {activeTab === 'webhooks' && (
          <WebhooksTab
            styles={styles}
            webhooks={webhooks}
            webhooksLoading={webhooksLoading}
            webhookModalOpen={webhookModalOpen}
            setWebhookModalOpen={setWebhookModalOpen}
            editingWebhook={editingWebhook}
            webhookForm={webhookForm}
            setWebhookForm={setWebhookForm}
            webhookSaving={webhookSaving}
            testingWebhook={testingWebhook}
            testResults={testResults}
            saveWebhook={saveWebhook}
            deleteWebhook={deleteWebhook}
            testWebhook={testWebhook}
            toggleWebhookEnabled={toggleWebhookEnabled}
            resetWebhookForm={resetWebhookForm}
            openEditWebhook={openEditWebhook}
          />
        )}
        {activeTab === 'email-templates' && (
          <EmailTemplatesTab
            styles={styles}
            templates={templates}
            templateVariables={templateVariables}
            templatesLoading={templatesLoading}
            editingTemplate={editingTemplate}
            setEditingTemplate={setEditingTemplate}
            templateForm={templateForm}
            setTemplateForm={setTemplateForm}
            templateSaving={templateSaving}
            templatePreview={templatePreview}
            setTemplatePreview={setTemplatePreview}
            previewLoading={previewLoading}
            saveTemplate={saveTemplate}
            resetTemplate={resetTemplate}
            previewTemplate={previewTemplate}
            toggleTemplateEnabled={toggleTemplateEnabled}
            openEditTemplate={openEditTemplate}
          />
        )}
        {activeTab === 'announcements' && (
          <AnnouncementsTab
            styles={styles}
            announcements={announcements}
            announcementsLoading={announcementsLoading}
            announcementForm={announcementForm}
            setAnnouncementForm={setAnnouncementForm}
            announcementSending={announcementSending}
            showAnnouncementForm={showAnnouncementForm}
            setShowAnnouncementForm={setShowAnnouncementForm}
            sendAnnouncement={sendAnnouncement}
          />
        )}
      </div>
    </>
  );
}
