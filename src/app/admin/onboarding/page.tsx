'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Input } from '@/components';
import { useToast } from '@/hooks/useToast';
import styles from './page.module.css';

interface AppItem { name: string; description?: string; icon?: string; url?: string }
interface LinkItem { label: string; url: string; description?: string }

interface OnboardingBlock {
  type: 'text' | 'features' | 'cta' | 'image' | 'divider' | 'apps' | 'links';
  title?: string;
  content?: string;
  items?: string[];
  buttonText?: string;
  buttonUrl?: string;
  imageUrl?: string;
  imageCaption?: string;
  apps?: AppItem[];
  links?: LinkItem[];
}

interface OnboardingSettings {
  onboardingTitle: string;
  onboardingSubtitle: string;
  onboardingButtonText: string;
  onboardingButtonUrl: string;
}

interface PreRegSettings {
  preRegisterTitle: string;
  preRegisterSubtitle: string;
  preRegisterChecklist: string[];
  requireInviteAcceptance: boolean;
  captchaEnabled: boolean;
}

const GUIDE_TYPES: OnboardingBlock['type'][] = ['features', 'text', 'links', 'image', 'divider'];

type PostStepKey = 'welcome' | 'apps' | 'guides' | 'ready';
const POST_STEPS: { key: PostStepKey; phase: string; label: string; hint: string }[] = [
  { key: 'welcome', phase: 'Onboard', label: 'Welcome', hint: 'Celebrate the new account' },
  { key: 'apps', phase: 'Onboard', label: 'Apps', hint: 'Recommend media clients' },
  { key: 'guides', phase: 'Onboard', label: 'Guides', hint: 'Tips and how-tos' },
  { key: 'ready', phase: 'Onboard', label: 'Ready', hint: 'Final CTA into the library' },
];

export default function OnboardingAdminPage() {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveBar, setShowSaveBar] = useState(false);
  const [activeTab, setActiveTab] = useState<'pre' | 'post'>('pre');
  const [previewStep, setPreviewStep] = useState<PostStepKey>('welcome');

  const [settings, setSettings] = useState<OnboardingSettings>({
    onboardingTitle: 'Welcome Aboard',
    onboardingSubtitle: "Your account has been created. Here's everything you need to know to get started.",
    onboardingButtonText: 'Start Watching',
    onboardingButtonUrl: '/',
  });
  const [blocks, setBlocks] = useState<OnboardingBlock[]>([]);
  const [preReg, setPreReg] = useState<PreRegSettings>({
    preRegisterTitle: 'Before You Start',
    preRegisterSubtitle: '',
    preRegisterChecklist: [],
    requireInviteAcceptance: false,
    captchaEnabled: false,
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/settings/onboarding').then((r) => r.ok ? r.json() : { content: [] }).catch(() => ({ content: [] })),
    ]).then(([s, o]) => {
      if (s) {
        setSettings({
          onboardingTitle: s.onboardingTitle || 'Welcome Aboard',
          onboardingSubtitle: s.onboardingSubtitle || "Your account has been created. Here's everything you need to know to get started.",
          onboardingButtonText: s.onboardingButtonText || 'Start Watching',
          onboardingButtonUrl: s.onboardingButtonUrl || '/',
        });
        let checklist: string[] = [];
        try {
          const raw = s.preRegisterChecklist;
          checklist = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
        } catch { /* ignore */ }
        setPreReg({
          preRegisterTitle: s.preRegisterTitle || 'Before You Start',
          preRegisterSubtitle: s.preRegisterSubtitle || '',
          preRegisterChecklist: checklist,
          requireInviteAcceptance: s.requireInviteAcceptance || false,
          captchaEnabled: s.captchaEnabled || false,
        });
      }
      setBlocks(o.content && o.content.length > 0 ? o.content : []);
    }).finally(() => setLoading(false));
  }, []);

  // === Step-scoped block selectors ===
  const appsBlock = useMemo(() => blocks.find((b) => b.type === 'apps'), [blocks]);
  const appsBlockIndex = useMemo(() => blocks.findIndex((b) => b.type === 'apps'), [blocks]);
  const guideBlocks = useMemo(
    () => blocks
      .map((b, i) => ({ block: b, index: i }))
      .filter(({ block }) => GUIDE_TYPES.includes(block.type) && block.type !== 'divider'),
    [blocks],
  );
  const ctaBlocks = useMemo(
    () => blocks.map((b, i) => ({ block: b, index: i })).filter(({ block }) => block.type === 'cta'),
    [blocks],
  );

  const markDirty = () => setShowSaveBar(true);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...settings,
            preRegisterTitle: preReg.preRegisterTitle,
            preRegisterSubtitle: preReg.preRegisterSubtitle,
            preRegisterChecklist: JSON.stringify(preReg.preRegisterChecklist),
            requireInviteAcceptance: preReg.requireInviteAcceptance,
            captchaEnabled: preReg.captchaEnabled,
          }),
        }),
        fetch('/api/settings/onboarding', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: blocks }),
        }),
      ]);
      success('Onboarding saved');
      setShowSaveBar(false);
    } catch {
      error('Failed to save onboarding');
    } finally {
      setSaving(false);
    }
  };

  // === Generic block ops ===
  const updateBlock = (index: number, updates: Partial<OnboardingBlock>) => {
    const next = [...blocks];
    next[index] = { ...next[index], ...updates };
    setBlocks(next);
    markDirty();
  };
  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
    markDirty();
  };
  const moveBlockWithinFilter = (indices: number[], srcPos: number, delta: -1 | 1) => {
    const targetPos = srcPos + delta;
    if (targetPos < 0 || targetPos >= indices.length) return;
    const srcIdx = indices[srcPos];
    const dstIdx = indices[targetPos];
    const next = [...blocks];
    [next[srcIdx], next[dstIdx]] = [next[dstIdx], next[srcIdx]];
    setBlocks(next);
    markDirty();
  };

  // === Apps step ops ===
  const ensureAppsBlock = (): number => {
    if (appsBlockIndex >= 0) return appsBlockIndex;
    const newBlock: OnboardingBlock = { type: 'apps', title: 'Recommended Apps', apps: [] };
    setBlocks((prev) => [...prev, newBlock]);
    markDirty();
    return blocks.length;
  };
  const updateAppsTitle = (title: string) => {
    if (appsBlockIndex < 0) {
      setBlocks([...blocks, { type: 'apps', title, apps: [] }]);
    } else {
      updateBlock(appsBlockIndex, { title });
    }
    markDirty();
  };
  const addApp = () => {
    const idx = ensureAppsBlock();
    const existing = blocks[idx]?.apps || [];
    setTimeout(() => {
      setBlocks((prev) => {
        const next = [...prev];
        const target = next[idx] || { type: 'apps' as const, apps: [] };
        next[idx] = { ...target, apps: [...(target.apps || existing), { name: '', description: '', icon: '', url: '' }] };
        return next;
      });
      markDirty();
    }, 0);
  };
  const updateApp = (appIdx: number, updates: Partial<AppItem>) => {
    if (appsBlockIndex < 0 || !appsBlock) return;
    const nextApps = [...(appsBlock.apps || [])];
    nextApps[appIdx] = { ...nextApps[appIdx], ...updates };
    updateBlock(appsBlockIndex, { apps: nextApps });
  };
  const removeApp = (appIdx: number) => {
    if (appsBlockIndex < 0 || !appsBlock) return;
    const nextApps = (appsBlock.apps || []).filter((_, i) => i !== appIdx);
    updateBlock(appsBlockIndex, { apps: nextApps });
  };

  // === Guides step ops ===
  const addGuide = (type: 'features' | 'text' | 'links' | 'image') => {
    let newBlock: OnboardingBlock;
    switch (type) {
      case 'features':
        newBlock = { type: 'features', title: 'Tip', items: ['A handy tip'] };
        break;
      case 'text':
        newBlock = { type: 'text', title: 'Section', content: 'Your content here…' };
        break;
      case 'links':
        newBlock = { type: 'links', title: 'Useful links', links: [{ label: '', url: '', description: '' }] };
        break;
      case 'image':
        newBlock = { type: 'image', imageUrl: '', imageCaption: '' };
        break;
    }
    setBlocks([...blocks, newBlock]);
    markDirty();
  };

  // === Ready step ops ===
  const addCta = () => {
    setBlocks([
      ...blocks,
      { type: 'cta', title: 'Also check out', content: 'A short teaser.', buttonText: 'Open', buttonUrl: '/' },
    ]);
    markDirty();
  };

  // === Pre-reg ops ===
  const setPreRegField = <K extends keyof PreRegSettings>(key: K, value: PreRegSettings[K]) => {
    setPreReg((prev) => ({ ...prev, [key]: value }));
    markDirty();
  };
  const addChecklistItem = () => {
    setPreReg((prev) => ({ ...prev, preRegisterChecklist: [...prev.preRegisterChecklist, ''] }));
    markDirty();
  };
  const updateChecklistItem = (index: number, value: string) => {
    setPreReg((prev) => {
      const items = [...prev.preRegisterChecklist];
      items[index] = value;
      return { ...prev, preRegisterChecklist: items };
    });
    markDirty();
  };
  const removeChecklistItem = (index: number) => {
    setPreReg((prev) => ({
      ...prev,
      preRegisterChecklist: prev.preRegisterChecklist.filter((_, i) => i !== index),
    }));
    markDirty();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Onboarding</h1>
          <p className={styles.subtitle}>
            Edit every step of the flow — the user-facing pages mirror this structure step-for-step.
            Visuals (particles, layout, glass) live in <a href="/admin/appearance" className={styles.inlineLink}>Appearance</a>.
          </p>
        </div>
      </div>

      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'pre' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('pre')}
        >
          Before registration
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'post' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('post')}
        >
          After registration
        </button>
      </div>

      <div className={styles.layout}>
        <div className={styles.editorCol}>
          {activeTab === 'pre' ? (
            <PreRegEditor
              preReg={preReg}
              setPreRegField={setPreRegField}
              addChecklistItem={addChecklistItem}
              updateChecklistItem={updateChecklistItem}
              removeChecklistItem={removeChecklistItem}
            />
          ) : (
            <PostRegEditor
              settings={settings}
              setSettings={(next) => { setSettings(next); markDirty(); }}
              appsBlock={appsBlock}
              appsBlockIndex={appsBlockIndex}
              updateAppsTitle={updateAppsTitle}
              addApp={addApp}
              updateApp={updateApp}
              removeApp={removeApp}
              guideBlocks={guideBlocks}
              ctaBlocks={ctaBlocks}
              addGuide={addGuide}
              addCta={addCta}
              updateBlock={updateBlock}
              removeBlock={removeBlock}
              moveBlockWithinFilter={moveBlockWithinFilter}
            />
          )}
        </div>

        <div className={styles.previewCol}>
          <div className={styles.previewHead}>
            <div className={styles.previewLabel}>Live preview</div>
            {activeTab === 'post' && (
              <div className={styles.stepSwitcher}>
                {POST_STEPS.map((s) => (
                  <button
                    key={s.key}
                    className={`${styles.stepChip} ${previewStep === s.key ? styles.stepChipActive : ''}`}
                    onClick={() => setPreviewStep(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.previewFrame}>
            <div className={styles.previewBg} />
            <div className={styles.previewVignette} />
            <div className={styles.previewContent} key={`${activeTab}-${previewStep}`}>
              {activeTab === 'pre' ? (
                <PreRegPreview preReg={preReg} />
              ) : (
                <PostRegPreview
                  step={previewStep}
                  settings={settings}
                  appsBlock={appsBlock}
                  guideBlocks={guideBlocks.map((g) => g.block)}
                  ctaBlocks={ctaBlocks.map((c) => c.block)}
                />
              )}
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

/* ========================= PRE-REG EDITOR ========================= */

function PreRegEditor({
  preReg,
  setPreRegField,
  addChecklistItem,
  updateChecklistItem,
  removeChecklistItem,
}: {
  preReg: PreRegSettings;
  setPreRegField: <K extends keyof PreRegSettings>(key: K, value: PreRegSettings[K]) => void;
  addChecklistItem: () => void;
  updateChecklistItem: (index: number, value: string) => void;
  removeChecklistItem: (index: number) => void;
}) {
  return (
    <div className={styles.stepStack}>
      <StepCard phase="Join" index={1} total={2} label="Invite" readOnly>
        <p className={styles.readOnlyText}>
          Shows the inviter&apos;s server name, libraries (resolved from Plex/Jellyfin) and access-until date.
          These come from the invite record and aren&apos;t editable here — create invites under{' '}
          <a href="/admin/invites" className={styles.inlineLink}>Invites</a>.
        </p>
      </StepCard>

      <StepCard phase="Join" index={2} total={2} label="Rules">
        <Input
          label="Title"
          value={preReg.preRegisterTitle}
          onChange={(e) => setPreRegField('preRegisterTitle', e.target.value)}
          hint="Shown above the checklist"
        />
        <Input
          label="Subtitle"
          value={preReg.preRegisterSubtitle}
          onChange={(e) => setPreRegField('preRegisterSubtitle', e.target.value)}
          hint="Optional supporting line"
        />

        <div className={styles.groupLabel}>Checklist items</div>
        <p className={styles.groupHint}>
          Each item becomes a tap-to-accept tile. Users must check every item to continue.
        </p>
        <div className={styles.checklistItems}>
          {preReg.preRegisterChecklist.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No rules yet. Add items users must acknowledge before registering.</p>
            </div>
          ) : (
            preReg.preRegisterChecklist.map((item, i) => (
              <div key={i} className={styles.featureItem}>
                <input
                  type="text"
                  placeholder="e.g. One account per person"
                  value={item}
                  onChange={(e) => updateChecklistItem(i, e.target.value)}
                />
                <button className={styles.removeItem} onClick={() => removeChecklistItem(i)} aria-label="Remove">
                  <IconX />
                </button>
              </div>
            ))
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={addChecklistItem}>+ Add rule</Button>

        <div className={styles.toggleGroup}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={preReg.requireInviteAcceptance}
              onChange={(e) => setPreRegField('requireInviteAcceptance', e.target.checked)}
            />
            <span>Require explicit confirmation</span>
          </label>
          <p className={styles.toggleHint}>Adds a final confirmation checkbox below the rules.</p>
        </div>

        <div className={styles.toggleGroup}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={preReg.captchaEnabled}
              onChange={(e) => setPreRegField('captchaEnabled', e.target.checked)}
            />
            <span>Enable arithmetic captcha</span>
          </label>
          <p className={styles.toggleHint}>Shows a simple math puzzle on the password step.</p>
        </div>
      </StepCard>
    </div>
  );
}

/* ========================= POST-REG EDITOR ========================= */

function PostRegEditor({
  settings,
  setSettings,
  appsBlock,
  appsBlockIndex,
  updateAppsTitle,
  addApp,
  updateApp,
  removeApp,
  guideBlocks,
  ctaBlocks,
  addGuide,
  addCta,
  updateBlock,
  removeBlock,
  moveBlockWithinFilter,
}: {
  settings: OnboardingSettings;
  setSettings: (s: OnboardingSettings) => void;
  appsBlock: OnboardingBlock | undefined;
  appsBlockIndex: number;
  updateAppsTitle: (v: string) => void;
  addApp: () => void;
  updateApp: (appIdx: number, updates: Partial<AppItem>) => void;
  removeApp: (appIdx: number) => void;
  guideBlocks: { block: OnboardingBlock; index: number }[];
  ctaBlocks: { block: OnboardingBlock; index: number }[];
  addGuide: (type: 'features' | 'text' | 'links' | 'image') => void;
  addCta: () => void;
  updateBlock: (index: number, updates: Partial<OnboardingBlock>) => void;
  removeBlock: (index: number) => void;
  moveBlockWithinFilter: (indices: number[], srcPos: number, delta: -1 | 1) => void;
}) {
  return (
    <div className={styles.stepStack}>
      {/* 1. Welcome */}
      <StepCard phase="Onboard" index={1} total={4} label="Welcome" hint="Celebrate the new account">
        <Input
          label="Title"
          value={settings.onboardingTitle}
          onChange={(e) => setSettings({ ...settings, onboardingTitle: e.target.value })}
        />
        <Input
          label="Subtitle"
          value={settings.onboardingSubtitle}
          onChange={(e) => setSettings({ ...settings, onboardingSubtitle: e.target.value })}
        />
      </StepCard>

      {/* 2. Apps */}
      <StepCard phase="Onboard" index={2} total={4} label="Apps" hint="Recommend media clients">
        <Input
          label="Section heading"
          placeholder="Install a client"
          value={appsBlock?.title || ''}
          onChange={(e) => updateAppsTitle(e.target.value)}
        />

        <div className={styles.groupLabel}>Apps to feature</div>
        <div className={styles.itemsList}>
          {(appsBlock?.apps || []).length === 0 ? (
            <div className={styles.emptyState}>
              <p>No apps yet. Add media client recommendations like Plex, Infuse, Jellyfin.</p>
            </div>
          ) : (
            (appsBlock?.apps || []).map((app, ai) => (
              <div key={ai} className={styles.itemEdit}>
                <div className={styles.twoColGrid}>
                  <input
                    type="text"
                    className={`${styles.blockInput} ${styles.noMargin}`}
                    placeholder="App name"
                    value={app.name}
                    onChange={(e) => updateApp(ai, { name: e.target.value })}
                  />
                  <input
                    type="text"
                    className={`${styles.blockInput} ${styles.noMargin}`}
                    placeholder="Download URL"
                    value={app.url || ''}
                    onChange={(e) => updateApp(ai, { url: e.target.value })}
                  />
                </div>
                <div className={styles.itemRow}>
                  <input
                    type="text"
                    className={`${styles.blockInput} ${styles.noMargin}`}
                    placeholder="Platforms / description"
                    value={app.description || ''}
                    onChange={(e) => updateApp(ai, { description: e.target.value })}
                  />
                  <button className={styles.removeItem} onClick={() => removeApp(ai)} aria-label="Remove app">
                    <IconX />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={addApp}>+ Add app</Button>
        {appsBlockIndex >= 0 && (appsBlock?.apps || []).length === 0 && (
          <p className={styles.skipHint}>
            Leave empty to skip the Apps step entirely — the user flow adapts automatically.
          </p>
        )}
      </StepCard>

      {/* 3. Guides */}
      <StepCard phase="Onboard" index={3} total={4} label="Guides" hint="Tips and how-tos — rendered as a two-column grid">
        {guideBlocks.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No guide tiles yet. Add bite-sized tips, feature lists, or external resources.</p>
          </div>
        ) : (
          <div className={styles.blocksList}>
            {guideBlocks.map(({ block, index }, posInFiltered) => (
              <GuideBlockEditor
                key={index}
                block={block}
                index={index}
                canMoveUp={posInFiltered > 0}
                canMoveDown={posInFiltered < guideBlocks.length - 1}
                onMove={(delta) => moveBlockWithinFilter(guideBlocks.map((g) => g.index), posInFiltered, delta)}
                onUpdate={(upd) => updateBlock(index, upd)}
                onRemove={() => removeBlock(index)}
              />
            ))}
          </div>
        )}
        <div className={styles.addBlockButtons}>
          <Button size="sm" variant="secondary" onClick={() => addGuide('features')}>+ Feature list</Button>
          <Button size="sm" variant="secondary" onClick={() => addGuide('text')}>+ Text tile</Button>
          <Button size="sm" variant="secondary" onClick={() => addGuide('links')}>+ Links</Button>
          <Button size="sm" variant="secondary" onClick={() => addGuide('image')}>+ Image</Button>
        </div>
      </StepCard>

      {/* 4. Ready */}
      <StepCard phase="Onboard" index={4} total={4} label="Ready" hint="Final CTA that sends the user into your library">
        <div className={styles.twoColGrid}>
          <Input
            label="Button text"
            value={settings.onboardingButtonText}
            onChange={(e) => setSettings({ ...settings, onboardingButtonText: e.target.value })}
          />
          <Input
            label="Button URL"
            value={settings.onboardingButtonUrl}
            onChange={(e) => setSettings({ ...settings, onboardingButtonUrl: e.target.value })}
            hint="Where the user lands (e.g. / or https://…)"
          />
        </div>

        <div className={styles.groupLabel}>Extra CTAs (optional)</div>
        <p className={styles.groupHint}>Secondary callouts shown above the main CTA on the Ready step.</p>
        <div className={styles.blocksList}>
          {ctaBlocks.map(({ block, index }) => (
            <div key={index} className={styles.blockEdit}>
              <div className={styles.blockHeader}>
                <span className={styles.blockType}>CTA</span>
                <button className={styles.blockAction} onClick={() => removeBlock(index)} aria-label="Remove">
                  <IconX />
                </button>
              </div>
              <input
                type="text"
                className={styles.blockInput}
                placeholder="Title"
                value={block.title || ''}
                onChange={(e) => updateBlock(index, { title: e.target.value })}
              />
              <textarea
                className={styles.blockTextarea}
                placeholder="Description"
                value={block.content || ''}
                onChange={(e) => updateBlock(index, { content: e.target.value })}
              />
              <div className={styles.twoColGrid}>
                <input
                  type="text"
                  className={`${styles.blockInput} ${styles.noMargin}`}
                  placeholder="Button text"
                  value={block.buttonText || ''}
                  onChange={(e) => updateBlock(index, { buttonText: e.target.value })}
                />
                <input
                  type="text"
                  className={`${styles.blockInput} ${styles.noMargin}`}
                  placeholder="Button URL"
                  value={block.buttonUrl || ''}
                  onChange={(e) => updateBlock(index, { buttonUrl: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={addCta}>+ Add extra CTA</Button>
      </StepCard>
    </div>
  );
}

function GuideBlockEditor({
  block, index,
  canMoveUp, canMoveDown, onMove,
  onUpdate, onRemove,
}: {
  block: OnboardingBlock;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (delta: -1 | 1) => void;
  onUpdate: (upd: Partial<OnboardingBlock>) => void;
  onRemove: () => void;
}) {
  const typeLabel = block.type === 'features' ? 'Feature list'
    : block.type === 'text' ? 'Text tile'
    : block.type === 'links' ? 'Links'
    : block.type === 'image' ? 'Image'
    : block.type;

  return (
    <div className={styles.blockEdit}>
      <div className={styles.blockHeader}>
        <div className={styles.blockHeaderLeft}>
          <span className={styles.blockType}>{typeLabel}</span>
          {canMoveUp && (
            <button className={styles.blockAction} onClick={() => onMove(-1)} aria-label="Move up">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
            </button>
          )}
          {canMoveDown && (
            <button className={styles.blockAction} onClick={() => onMove(1)} aria-label="Move down">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          )}
        </div>
        <button className={styles.blockAction} onClick={onRemove} aria-label="Remove">
          <IconX />
        </button>
      </div>

      {block.type === 'image' ? (
        <>
          <input
            type="text"
            className={styles.blockInput}
            placeholder="Image URL"
            value={block.imageUrl || ''}
            onChange={(e) => onUpdate({ imageUrl: e.target.value })}
          />
          <input
            type="text"
            className={styles.blockInput}
            placeholder="Caption (optional)"
            value={block.imageCaption || ''}
            onChange={(e) => onUpdate({ imageCaption: e.target.value })}
          />
        </>
      ) : (
        <input
          type="text"
          className={styles.blockInput}
          placeholder="Title"
          value={block.title || ''}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
      )}

      {block.type === 'text' && (
        <textarea
          className={styles.blockTextarea}
          placeholder="Content"
          value={block.content || ''}
          onChange={(e) => onUpdate({ content: e.target.value })}
        />
      )}

      {block.type === 'features' && (
        <div className={styles.featureItems}>
          {(block.items || []).map((item, itemIdx) => (
            <div key={itemIdx} className={styles.featureItem}>
              <input
                type="text"
                placeholder="List item"
                value={item}
                onChange={(e) => {
                  const next = [...(block.items || [])];
                  next[itemIdx] = e.target.value;
                  onUpdate({ items: next });
                }}
              />
              <button
                className={styles.removeItem}
                onClick={() => onUpdate({ items: (block.items || []).filter((_, i) => i !== itemIdx) })}
                aria-label="Remove"
              >
                <IconX />
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => onUpdate({ items: [...(block.items || []), ''] })}>
            + Add item
          </Button>
        </div>
      )}

      {block.type === 'links' && (
        <div className={styles.itemsList}>
          {(block.links || []).map((link, li) => (
            <div key={li} className={styles.itemRow}>
              <input
                type="text"
                className={`${styles.blockInput} ${styles.noMargin}`}
                placeholder="Label"
                value={link.label}
                onChange={(e) => {
                  const next = [...(block.links || [])];
                  next[li] = { ...next[li], label: e.target.value };
                  onUpdate({ links: next });
                }}
              />
              <input
                type="text"
                className={`${styles.blockInput} ${styles.noMargin}`}
                placeholder="URL"
                value={link.url}
                onChange={(e) => {
                  const next = [...(block.links || [])];
                  next[li] = { ...next[li], url: e.target.value };
                  onUpdate({ links: next });
                }}
              />
              <button
                className={styles.removeItem}
                onClick={() => onUpdate({ links: (block.links || []).filter((_, i) => i !== li) })}
                aria-label="Remove"
              >
                <IconX />
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => onUpdate({ links: [...(block.links || []), { label: '', url: '', description: '' }] })}>
            + Add link
          </Button>
        </div>
      )}
    </div>
  );
}

/* ========================= PREVIEWS ========================= */

function PreRegPreview({ preReg }: { preReg: PreRegSettings }) {
  return (
    <>
      <div className={styles.previewKicker}>Step 02 · House rules</div>
      <div className={styles.previewTitle}>{preReg.preRegisterTitle || 'Before You Start'}</div>
      {preReg.preRegisterSubtitle && (
        <div className={styles.previewSubtitle}>{preReg.preRegisterSubtitle}</div>
      )}
      {preReg.preRegisterChecklist.filter(Boolean).length > 0 && (
        <div className={styles.previewRules}>
          {preReg.preRegisterChecklist.filter(Boolean).map((item, j) => (
            <div key={j} className={styles.previewRule}>
              <span className={styles.previewRuleDot} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
      {preReg.requireInviteAcceptance && (
        <div className={styles.previewCheckbox}>
          <div className={styles.previewCheckboxBox} />
          <span>I understand and accept these invite requirements.</span>
        </div>
      )}
      <div className={styles.previewAction}>Accept &amp; continue</div>
    </>
  );
}

function PostRegPreview({
  step,
  settings,
  appsBlock,
  guideBlocks,
  ctaBlocks,
}: {
  step: PostStepKey;
  settings: OnboardingSettings;
  appsBlock: OnboardingBlock | undefined;
  guideBlocks: OnboardingBlock[];
  ctaBlocks: OnboardingBlock[];
}) {
  if (step === 'welcome') {
    return (
      <>
        <div className={styles.previewEmblem} aria-hidden="true">
          <span className={styles.previewEmblemRing} />
          <span className={`${styles.previewEmblemRing} ${styles.previewEmblemRing2}`} />
          <div className={styles.previewEmblemCore}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="12" rx="4" ry="9" />
              <ellipse cx="12" cy="12" rx="9" ry="4" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </div>
        </div>
        <div className={styles.previewKicker}>Account created</div>
        <div className={styles.previewTitle}>{settings.onboardingTitle || 'Welcome aboard'}</div>
        <div className={styles.previewSubtitle}>{settings.onboardingSubtitle}</div>
        <div className={styles.previewChips}>
          <span className={styles.previewChip}>
            <span className={styles.previewChipDot} /> Server online
          </span>
          <span className={`${styles.previewChip} ${styles.previewChipGhost}`}>4K · HDR · Atmos</span>
        </div>
      </>
    );
  }

  if (step === 'apps') {
    const apps = appsBlock?.apps || [];
    return (
      <>
        <div className={styles.previewKicker}>Step · Get the apps</div>
        <div className={styles.previewTitle}>{appsBlock?.title || 'Install a client'}</div>
        <div className={styles.previewSubtitle}>Sign in with the credentials you just created.</div>
        {apps.length === 0 ? (
          <div className={styles.previewEmpty}>Step auto-skipped — no apps configured.</div>
        ) : (
          <div className={styles.previewAppsGrid}>
            {apps.map((app, i) => (
              <div key={i} className={styles.previewAppCard}>
                <div className={styles.previewAppIcon}>{app.name[0]?.toUpperCase() || '?'}</div>
                <div className={styles.previewAppInfo}>
                  <span className={styles.previewAppName}>{app.name || 'App'}</span>
                  {app.description && <span className={styles.previewAppDesc}>{app.description}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  if (step === 'guides') {
    return (
      <>
        <div className={styles.previewKicker}>Step · Short manual</div>
        <div className={styles.previewTitle}>Stuff worth knowing.</div>
        <div className={styles.previewSubtitle}>A few things that make the experience nicer.</div>
        {guideBlocks.length === 0 ? (
          <div className={styles.previewEmpty}>Step auto-skipped — no guides added.</div>
        ) : (
          <div className={styles.previewGuidesGrid}>
            {guideBlocks.map((b, i) => (
              <div key={i} className={styles.previewGuide}>
                <div className={styles.previewGuideIcon}>
                  {b.type === 'features' ? '✓' : b.type === 'links' ? '↗' : b.type === 'image' ? '▢' : 'i'}
                </div>
                <div>
                  {b.title && <div className={styles.previewGuideTitle}>{b.title}</div>}
                  {b.type === 'text' && b.content && (
                    <div className={styles.previewGuideBody}>{b.content}</div>
                  )}
                  {b.type === 'features' && b.items && (
                    <div className={styles.previewGuideBody}>
                      {b.items.filter(Boolean).slice(0, 3).join(' · ')}
                    </div>
                  )}
                  {b.type === 'links' && b.links && (
                    <div className={styles.previewGuideBody}>
                      {b.links.map((l) => l.label).filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // ready
  return (
    <>
      <div className={styles.previewSpark}>✦</div>
      <div className={styles.previewTitle}>You&apos;re all set.</div>
      <div className={styles.previewSubtitle}>Step through the portal and start watching.</div>
      {ctaBlocks.length > 0 && (
        <div className={styles.previewCtaList}>
          {ctaBlocks.map((b, i) => (
            <div key={i} className={styles.previewBlock}>
              {b.title && <div className={styles.previewBlockTitle}>{b.title}</div>}
              {b.content && <div className={styles.previewBlockText}>{b.content}</div>}
            </div>
          ))}
        </div>
      )}
      <div className={styles.previewAction}>{settings.onboardingButtonText || 'Start watching'}</div>
    </>
  );
}

/* ========================= UTILS ========================= */

function StepCard({
  phase, index, total, label, hint, readOnly, children,
}: {
  phase: string;
  index: number;
  total: number;
  label: string;
  hint?: string;
  readOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`${styles.stepCard} ${readOnly ? styles.stepCardReadOnly : ''}`}>
      <header className={styles.stepCardHead}>
        <div className={styles.stepCardMeta}>
          <span className={styles.stepCardPhase}>{phase} · {String(index).padStart(2, '0')}/{String(total).padStart(2, '0')}</span>
          <h2 className={styles.stepCardTitle}>{label}</h2>
          {hint && <p className={styles.stepCardHint}>{hint}</p>}
        </div>
        {readOnly && <span className={styles.stepCardBadge}>Automatic</span>}
      </header>
      <div className={styles.stepCardBody}>{children}</div>
    </section>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
