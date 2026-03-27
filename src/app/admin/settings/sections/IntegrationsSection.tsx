'use client';

import { Input } from '@/components';
import { SectionProps, Settings } from './types';

interface IntegrationsSectionProps extends SectionProps {
  showSeerrApiKey: boolean;
  setShowSeerrApiKey: (show: boolean) => void;
  jellyseerrApiKeyDirty: boolean;
  setJellyseerrApiKeyDirty: (dirty: boolean) => void;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setShowSaveBar: (show: boolean) => void;
}

export default function IntegrationsSection({
  settings,
  set,
  styles,
  showSeerrApiKey,
  setShowSeerrApiKey,
  jellyseerrApiKeyDirty,
  setJellyseerrApiKeyDirty,
  setSettings,
  setShowSaveBar,
}: IntegrationsSectionProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Integrations</h2>
      <p className={styles.sectionDescription}>Connect external services for enhanced features</p>
      <div className={styles.integrationCard}>
        <div className={styles.integrationHeader}>
          <div className={styles.integrationIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div>
            <div className={styles.integrationName}>Seerr</div>
            <div className={styles.integrationDesc}>Manage media requests and quotas</div>
          </div>
          {settings.jellyseerrUrl && (settings.hasJellyseerrApiKey || jellyseerrApiKeyDirty) && (
            <span className={styles.integrationBadge}>Connected</span>
          )}
        </div>
        <div className={styles.integrationFields}>
          <Input
            label="Seerr URL"
            placeholder="http://localhost:5055"
            value={settings.jellyseerrUrl}
            onChange={(e) => set('jellyseerrUrl', e.target.value)}
          />
          <div className={styles.apiKeyField}>
            <Input
              label="API Key"
              type={showSeerrApiKey ? 'text' : 'password'}
              placeholder="Settings > General > API Key"
              value={settings.jellyseerrApiKey}
              onChange={(e) => {
                setSettings(prev => ({ ...prev, jellyseerrApiKey: e.target.value }));
                setJellyseerrApiKeyDirty(true);
                setShowSaveBar(true);
              }}
            />
            <button
              type="button"
              className={styles.apiKeyToggle}
              onClick={() => setShowSeerrApiKey(!showSeerrApiKey)}
              title={showSeerrApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showSeerrApiKey ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
