'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@/components';
import {
  FONT_MAP, FONT_LABELS, DISPLAY_FONT_LABELS,
  loadGoogleFont, applyAccentColor, applyFonts,
} from '@/lib/theme';
import styles from './page.module.css';

interface AppearanceState {
  accentColor: string;
  appName: string;
  logoUrl: string;
  logoMode: string;
  subtitleText: string;
  backgroundStyle: string;
  backgroundImageUrl: string;
  backgroundOverlay: number;
  cardStyle: string;
  borderRadius: string;
  cardWidth: string;
  fontFamily: string;
  fontDisplay: string;
  buttonStyle: string;
  inputStyle: string;
  enableAnimations: boolean;
  enableNoise: boolean;
  gradientDirection: string;
  welcomeTitle: string;
  registerTitle: string;
  footerText: string;
  hideAdminLink: boolean;
  buttonText: string;
  registerButtonText: string;
  customCss: string;
}

const DEFAULTS: AppearanceState = {
  accentColor: '#A78BFA',
  appName: 'Portalrr',
  logoUrl: '',
  logoMode: 'icon',
  subtitleText: 'Enter your invite code to join the server',
  backgroundStyle: 'gradient',
  backgroundImageUrl: '',
  backgroundOverlay: 0.7,
  cardStyle: 'bordered',
  borderRadius: 'large',
  cardWidth: 'default',
  fontFamily: 'dm-sans',
  fontDisplay: 'same',
  buttonStyle: 'rounded',
  inputStyle: 'outlined',
  enableAnimations: true,
  enableNoise: true,
  gradientDirection: 'top',
  welcomeTitle: 'Welcome',
  registerTitle: 'Create Your Account',
  footerText: '',
  hideAdminLink: false,
  buttonText: 'Continue',
  registerButtonText: 'Create Account',
  customCss: '',
};

const PRESETS: { name: string; values: Partial<AppearanceState> }[] = [
  { name: 'Default', values: { accentColor: '#A78BFA', backgroundStyle: 'gradient', cardStyle: 'bordered', borderRadius: 'large', fontFamily: 'dm-sans', fontDisplay: 'space-grotesk', buttonStyle: 'rounded', inputStyle: 'outlined', enableNoise: true, gradientDirection: 'top' } },
  { name: 'Minimal', values: { accentColor: '#9DA3AE', backgroundStyle: 'solid', cardStyle: 'flat', borderRadius: 'none', fontFamily: 'system', fontDisplay: 'same', buttonStyle: 'square', inputStyle: 'underline', enableNoise: false, gradientDirection: 'top' } },
  { name: 'Glass', values: { accentColor: '#7DD3FC', backgroundStyle: 'gradient', cardStyle: 'glass', borderRadius: 'large', fontFamily: 'inter', fontDisplay: 'same', buttonStyle: 'pill', inputStyle: 'filled', enableNoise: true, gradientDirection: 'center' } },
  { name: 'Elegant', values: { accentColor: '#D4A853', backgroundStyle: 'gradient', cardStyle: 'elevated', borderRadius: 'medium', fontFamily: 'dm-sans', fontDisplay: 'playfair', buttonStyle: 'rounded', inputStyle: 'outlined', enableNoise: true, gradientDirection: 'bottom-right' } },
  { name: 'Jellyfin', values: { accentColor: '#00A4DC', backgroundStyle: 'gradient', cardStyle: 'bordered', borderRadius: 'large', fontFamily: 'dm-sans', fontDisplay: 'space-grotesk', buttonStyle: 'rounded', inputStyle: 'outlined', enableNoise: true, gradientDirection: 'top' } },
  { name: 'Plex', values: { accentColor: '#E5A00D', backgroundStyle: 'gradient', cardStyle: 'elevated', borderRadius: 'medium', fontFamily: 'dm-sans', fontDisplay: 'outfit', buttonStyle: 'rounded', inputStyle: 'filled', enableNoise: true, gradientDirection: 'radial' } },
  { name: 'Terminal', values: { accentColor: '#4ADE80', backgroundStyle: 'solid', cardStyle: 'bordered', borderRadius: 'small', fontFamily: 'mono', fontDisplay: 'same', buttonStyle: 'square', inputStyle: 'outlined', enableNoise: false, gradientDirection: 'top' } },
  { name: 'Coral', values: { accentColor: '#FB7185', backgroundStyle: 'gradient', cardStyle: 'glass', borderRadius: 'large', fontFamily: 'inter', fontDisplay: 'outfit', buttonStyle: 'pill', inputStyle: 'filled', enableNoise: true, gradientDirection: 'bottom-right' } },
];

export default function AppearancePage() {
  const [form, setForm] = useState<AppearanceState>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [showSaveBar, setShowSaveBar] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        setForm({
          accentColor: data.accentColor || DEFAULTS.accentColor,
          appName: data.appName || DEFAULTS.appName,
          logoUrl: data.logoUrl || '',
          logoMode: data.logoMode || DEFAULTS.logoMode,
          subtitleText: data.subtitleText || DEFAULTS.subtitleText,
          backgroundStyle: data.backgroundStyle || DEFAULTS.backgroundStyle,
          backgroundImageUrl: data.backgroundImageUrl || '',
          backgroundOverlay: data.backgroundOverlay ?? DEFAULTS.backgroundOverlay,
          cardStyle: data.cardStyle || DEFAULTS.cardStyle,
          borderRadius: data.borderRadius || DEFAULTS.borderRadius,
          cardWidth: data.cardWidth || DEFAULTS.cardWidth,
          fontFamily: data.fontFamily || DEFAULTS.fontFamily,
          fontDisplay: data.fontDisplay || DEFAULTS.fontDisplay,
          buttonStyle: data.buttonStyle || DEFAULTS.buttonStyle,
          inputStyle: data.inputStyle || DEFAULTS.inputStyle,
          enableAnimations: data.enableAnimations ?? DEFAULTS.enableAnimations,
          enableNoise: data.enableNoise ?? DEFAULTS.enableNoise,
          gradientDirection: data.gradientDirection || DEFAULTS.gradientDirection,
          welcomeTitle: data.welcomeTitle || DEFAULTS.welcomeTitle,
          registerTitle: data.registerTitle || DEFAULTS.registerTitle,
          footerText: data.footerText || '',
          hideAdminLink: data.hideAdminLink ?? false,
          buttonText: data.buttonText || DEFAULTS.buttonText,
          registerButtonText: data.registerButtonText || DEFAULTS.registerButtonText,
          customCss: data.customCss || '',
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const update = (field: keyof AppearanceState, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setShowSaveBar(true);

    // Live preview updates
    if (field === 'accentColor' && typeof value === 'string') {
      applyAccentColor(value);
    }
    if (field === 'fontFamily' && typeof value === 'string') {
      loadGoogleFont(value);
      document.documentElement.style.setProperty('--font-body', FONT_MAP[value] || FONT_MAP['system']);
    }
    if (field === 'fontDisplay' && typeof value === 'string') {
      applyFonts(undefined, value);
    }
  };

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setForm((prev) => ({ ...prev, ...preset.values }));
    setShowSaveBar(true);
    if (preset.values.accentColor) applyAccentColor(preset.values.accentColor);
    if (preset.values.fontFamily) {
      loadGoogleFont(preset.values.fontFamily);
      document.documentElement.style.setProperty('--font-body', FONT_MAP[preset.values.fontFamily] || FONT_MAP['system']);
    }
    if (preset.values.fontDisplay) applyFonts(undefined, preset.values.fontDisplay);
  };

  const handleReset = () => {
    if (!confirm('Reset all appearance settings to factory defaults? This cannot be undone after saving.')) return;
    setForm({ ...DEFAULTS });
    applyAccentColor(DEFAULTS.accentColor);
    applyFonts(DEFAULTS.fontFamily, DEFAULTS.fontDisplay);
    setShowSaveBar(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          logoUrl: form.logoUrl || null,
          backgroundImageUrl: form.backgroundImageUrl || null,
          footerText: form.footerText || null,
          customCss: form.customCss || null,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        const ver = saved.themeVersion || Date.now();
        const savedColor = saved.accentColor || form.accentColor;
        document.cookie = `accent_color=${encodeURIComponent(JSON.stringify({ color: savedColor, ver }))}; path=/; max-age=31536000; SameSite=Lax`;
        applyAccentColor(savedColor);
      }
      setShowSaveBar(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  const RADIUS_VALUES: Record<string, string> = { none: '0px', small: '8px', medium: '12px', large: '16px' };
  const previewRadius = RADIUS_VALUES[form.borderRadius] || '16px';

  // Preview background
  const previewBgStyle: React.CSSProperties = {};
  if (form.backgroundStyle === 'gradient') {
    const gradients: Record<string, string> = {
      top: `linear-gradient(175deg, ${form.accentColor}2d 0%, transparent 40%), var(--bg-deep)`,
      center: `radial-gradient(ellipse 70% 60% at 50% 40%, ${form.accentColor}2d 0%, transparent 60%), var(--bg-deep)`,
      'bottom-right': `linear-gradient(150deg, transparent 30%, ${form.accentColor}2d 100%), var(--bg-deep)`,
      radial: `radial-gradient(circle at 50% 50%, ${form.accentColor}2d 0%, transparent 50%), var(--bg-deep)`,
    };
    previewBgStyle.background = gradients[form.gradientDirection] || gradients.top;
  } else if (form.backgroundStyle === 'solid') {
    previewBgStyle.background = 'var(--bg-deep)';
  } else if (form.backgroundStyle === 'image' && form.backgroundImageUrl) {
    previewBgStyle.backgroundImage = `url(${form.backgroundImageUrl})`;
    previewBgStyle.backgroundSize = 'cover';
    previewBgStyle.backgroundPosition = 'center';
  }

  // Preview card
  const cardStyles: React.CSSProperties = { borderRadius: previewRadius };
  if (form.cardStyle === 'bordered') { cardStyles.background = 'var(--bg-surface)'; cardStyles.border = '1px solid var(--border)'; }
  else if (form.cardStyle === 'elevated') { cardStyles.background = 'var(--bg-surface)'; cardStyles.border = 'none'; cardStyles.boxShadow = '0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)'; }
  else if (form.cardStyle === 'glass') { cardStyles.background = 'rgba(20,20,20,0.5)'; cardStyles.backdropFilter = 'blur(20px)'; cardStyles.border = '1px solid rgba(255,255,255,0.08)'; }
  else if (form.cardStyle === 'flat') { cardStyles.background = 'transparent'; cardStyles.border = 'none'; }

  const btnRadius = form.buttonStyle === 'pill' ? '999px' : form.buttonStyle === 'square' ? '4px' : previewRadius;

  const inputBoxStyle: React.CSSProperties = { borderRadius: form.inputStyle === 'underline' ? '0px' : previewRadius };
  if (form.inputStyle === 'outlined') { inputBoxStyle.background = 'var(--bg-elevated)'; inputBoxStyle.border = '1px solid var(--border)'; }
  else if (form.inputStyle === 'filled') { inputBoxStyle.background = 'var(--bg-elevated)'; inputBoxStyle.border = '1px solid transparent'; }
  else if (form.inputStyle === 'underline') { inputBoxStyle.background = 'transparent'; inputBoxStyle.border = 'none'; inputBoxStyle.borderBottom = '1px solid var(--border)'; }

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Appearance</h1>
        <p className={styles.pageSubtitle}>Customize how the invite pages look to your users</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.settingsPanel}>
          {/* Theme Presets */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Theme Presets</h2>
              <button className={styles.resetButton} onClick={handleReset}>Reset to Defaults</button>
            </div>
            <div className={styles.presetGrid}>
              {PRESETS.map((preset) => (
                <button key={preset.name} className={styles.presetButton} onClick={() => applyPreset(preset)}>
                  <div className={styles.presetSwatch} style={{ background: preset.values.accentColor }} />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Branding */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Branding</h2>
            <div className={styles.fieldGroup}>
              <Input label="App Name" value={form.appName} onChange={(e) => update('appName', e.target.value)} />
              <div className={styles.field}>
                <label className={styles.label}>Logo</label>
                <div className={styles.optionRow}>
                  {(['icon', 'image', 'none'] as const).map((mode) => (
                    <button key={mode} className={`${styles.optionButton} ${form.logoMode === mode ? styles.selected : ''}`} onClick={() => update('logoMode', mode)}>
                      {mode === 'icon' ? 'Default Icon' : mode === 'image' ? 'Custom Image' : 'None'}
                    </button>
                  ))}
                </div>
              </div>
              {form.logoMode === 'image' && (
                <Input label="Logo URL" placeholder="https://example.com/logo.png" value={form.logoUrl} onChange={(e) => update('logoUrl', e.target.value)} hint="Direct link to your logo image" />
              )}
            </div>
          </div>

          {/* Colors & Background */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Colors & Background</h2>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label className={styles.label}>Accent Color</label>
                <div className={styles.colorRow}>
                  <input type="color" className={styles.colorPicker} value={form.accentColor} onChange={(e) => update('accentColor', e.target.value)} />
                  <input type="text" className={styles.colorInput} value={form.accentColor} onChange={(e) => update('accentColor', e.target.value)} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Background</label>
                <div className={styles.optionRow}>
                  {(['gradient', 'solid', 'image'] as const).map((bg) => (
                    <button key={bg} className={`${styles.optionButton} ${form.backgroundStyle === bg ? styles.selected : ''}`} onClick={() => update('backgroundStyle', bg)}>
                      {bg === 'gradient' ? 'Gradient' : bg === 'solid' ? 'Solid' : 'Image'}
                    </button>
                  ))}
                </div>
              </div>
              {form.backgroundStyle === 'gradient' && (
                <div className={styles.field}>
                  <label className={styles.label}>Gradient Direction</label>
                  <div className={styles.optionRow}>
                    {(['top', 'center', 'bottom-right', 'radial'] as const).map((dir) => (
                      <button key={dir} className={`${styles.optionButton} ${form.gradientDirection === dir ? styles.selected : ''}`} onClick={() => update('gradientDirection', dir)}>
                        {dir === 'top' ? 'Top' : dir === 'center' ? 'Center' : dir === 'bottom-right' ? 'Corner' : 'Radial'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {form.backgroundStyle === 'image' && (
                <>
                  <Input label="Background Image URL" placeholder="https://example.com/bg.jpg" value={form.backgroundImageUrl} onChange={(e) => update('backgroundImageUrl', e.target.value)} />
                  <div className={styles.field}>
                    <label className={styles.label}>Overlay Opacity: {Math.round(form.backgroundOverlay * 100)}%</label>
                    <input type="range" className={styles.slider} min="0" max="1" step="0.05" value={form.backgroundOverlay} onChange={(e) => update('backgroundOverlay', parseFloat(e.target.value))} />
                  </div>
                </>
              )}
              <div className={styles.checkboxField}>
                <label className={styles.checkbox}>
                  <input type="checkbox" checked={form.enableNoise} onChange={(e) => update('enableNoise', e.target.checked)} />
                  <span>Noise texture overlay</span>
                </label>
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Typography</h2>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label className={styles.label}>Body Font</label>
                <div className={styles.optionRow}>
                  {Object.entries(FONT_LABELS).map(([key, label]) => (
                    <button key={key} className={`${styles.optionButton} ${form.fontFamily === key ? styles.selected : ''}`} onClick={() => update('fontFamily', key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Display Font (headings)</label>
                <div className={styles.optionRow}>
                  {Object.entries(DISPLAY_FONT_LABELS).map(([key, label]) => (
                    <button key={key} className={`${styles.optionButton} ${form.fontDisplay === key ? styles.selected : ''}`} onClick={() => update('fontDisplay', key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card & Layout */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Card & Layout</h2>
            <div className={styles.fieldGroup}>
              <div className={styles.cardStyleGrid}>
                {(['bordered', 'elevated', 'glass', 'flat'] as const).map((style) => (
                  <button key={style} className={`${styles.cardStyleOption} ${form.cardStyle === style ? styles.selected : ''}`} onClick={() => update('cardStyle', style)}>
                    <div className={`${styles.cardStylePreview} ${styles[`preview_${style}`]}`} />
                    <span>{style.charAt(0).toUpperCase() + style.slice(1)}</span>
                  </button>
                ))}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Border Radius</label>
                <div className={styles.optionRow}>
                  {(['none', 'small', 'medium', 'large'] as const).map((r) => (
                    <button key={r} className={`${styles.optionButton} ${form.borderRadius === r ? styles.selected : ''}`} onClick={() => update('borderRadius', r)}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Card Width</label>
                <div className={styles.optionRow}>
                  {(['compact', 'default', 'wide'] as const).map((w) => (
                    <button key={w} className={`${styles.optionButton} ${form.cardWidth === w ? styles.selected : ''}`} onClick={() => update('cardWidth', w)}>
                      {w.charAt(0).toUpperCase() + w.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Controls</h2>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label className={styles.label}>Button Style</label>
                <div className={styles.optionRow}>
                  {(['rounded', 'pill', 'square'] as const).map((s) => (
                    <button key={s} className={`${styles.optionButton} ${form.buttonStyle === s ? styles.selected : ''}`} onClick={() => update('buttonStyle', s)}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Input Style</label>
                <div className={styles.optionRow}>
                  {(['outlined', 'filled', 'underline'] as const).map((s) => (
                    <button key={s} className={`${styles.optionButton} ${form.inputStyle === s ? styles.selected : ''}`} onClick={() => update('inputStyle', s)}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.checkboxField}>
                <label className={styles.checkbox}>
                  <input type="checkbox" checked={form.enableAnimations} onChange={(e) => update('enableAnimations', e.target.checked)} />
                  <span>Enable page animations</span>
                </label>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Content</h2>
            <div className={styles.fieldGroup}>
              <Input label="Welcome Title" value={form.welcomeTitle} onChange={(e) => update('welcomeTitle', e.target.value)} hint="Heading on the invite code page" />
              <Input label="Subtitle Text" value={form.subtitleText} onChange={(e) => update('subtitleText', e.target.value)} hint="Text below the welcome title" />
              <Input label="Button Text" value={form.buttonText} onChange={(e) => update('buttonText', e.target.value)} hint="Text on the invite page button" />
              <Input label="Register Title" value={form.registerTitle} onChange={(e) => update('registerTitle', e.target.value)} hint="Heading on the registration page" />
              <Input label="Register Button Text" value={form.registerButtonText} onChange={(e) => update('registerButtonText', e.target.value)} hint="Text on the registration button" />
              <Input label="Footer Text" value={form.footerText} onChange={(e) => update('footerText', e.target.value)} hint="Optional text shown below the card" />
              <div className={styles.checkboxField}>
                <label className={styles.checkbox}>
                  <input type="checkbox" checked={form.hideAdminLink} onChange={(e) => update('hideAdminLink', e.target.checked)} />
                  <span>Hide admin login link</span>
                </label>
              </div>
            </div>
          </div>

          {/* Custom CSS */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Custom CSS</h2>
            <textarea className={styles.cssEditor} placeholder="/* Add custom CSS here */" value={form.customCss} onChange={(e) => update('customCss', e.target.value)} />
          </div>
        </div>

        {/* Live Preview */}
        <div className={styles.previewPanel}>
          <div className={styles.previewLabel}>Live Preview</div>
          <div className={styles.previewFrame}>
            <div className={styles.previewBackground} style={previewBgStyle}>
              {form.backgroundStyle === 'image' && form.backgroundImageUrl && (
                <div className={styles.previewOverlay} style={{ opacity: form.backgroundOverlay }} />
              )}
            </div>
            <div className={styles.previewContent}>
              <div className={styles.previewLogo}>
                {form.logoMode === 'icon' && (
                  <div className={styles.previewLogoIcon}>
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="3" width="18" height="18" rx="4" style={{ fill: 'var(--accent)' }} />
                      <rect x="7" y="7" width="10" height="10" rx="2.5" style={{ fill: '#0A0A0A' }} />
                      <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" style={{ fill: 'var(--accent)' }} />
                    </svg>
                  </div>
                )}
                {form.logoMode === 'image' && form.logoUrl && (
                  <img src={form.logoUrl} alt="" className={styles.previewLogoImg} />
                )}
                <span className={styles.previewAppName}>{form.appName}</span>
              </div>

              <div className={styles.previewCard} style={cardStyles}>
                <div className={styles.previewCardTitle}>{form.welcomeTitle}</div>
                <div className={styles.previewCardSubtitle}>{form.subtitleText}</div>
                <div className={styles.previewInput}>
                  <div className={styles.previewInputLabel}>Invite Code</div>
                  <div className={styles.previewInputBox} style={inputBoxStyle} />
                </div>
                <div className={styles.previewButton} style={{ background: form.accentColor, borderRadius: btnRadius }}>
                  {form.buttonText || 'Continue'}
                </div>
              </div>

              <div className={styles.previewFooter}>
                {form.footerText && <span>{form.footerText}</span>}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <span>My Account</span>
                  {!form.hideAdminLink && <span>Admin login</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSaveBar && (
        <div className={styles.saveBar}>
          <span className={styles.saveBarText}>You have unsaved changes</span>
          <Button size="sm" onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>
      )}
    </div>
  );
}
