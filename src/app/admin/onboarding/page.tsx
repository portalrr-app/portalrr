'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@/components';
import { useToast } from '@/hooks/useToast';
import styles from './page.module.css';

interface AppItem {
  name: string;
  description?: string;
  icon?: string;
  url?: string;
}

interface LinkItem {
  label: string;
  url: string;
  description?: string;
}

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

export default function OnboardingPage() {
  const { success, error } = useToast();
  const [settings, setSettings] = useState<OnboardingSettings>({
    onboardingTitle: 'Welcome Aboard',
    onboardingSubtitle: "Your account has been created. Here's everything you need to know to get started.",
    onboardingButtonText: 'Start Watching',
    onboardingButtonUrl: '/',
  });
  const [blocks, setBlocks] = useState<OnboardingBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveBar, setShowSaveBar] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [activeTab, setActiveTab] = useState<'pre' | 'post'>('pre');
  const [preReg, setPreReg] = useState<PreRegSettings>({
    preRegisterTitle: 'Before You Start',
    preRegisterSubtitle: '',
    preRegisterChecklist: [],
    requireInviteAcceptance: false,
    captchaEnabled: false,
  });

  useEffect(() => {
    Promise.all([fetchSettings(), fetchBlocks()]).finally(() => setLoading(false));
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          onboardingTitle: data.onboardingTitle || 'Welcome Aboard',
          onboardingSubtitle: data.onboardingSubtitle || "Your account has been created. Here's everything you need to know to get started.",
          onboardingButtonText: data.onboardingButtonText || 'Start Watching',
          onboardingButtonUrl: data.onboardingButtonUrl || '/',
        });
        let checklist: string[] = [];
        try {
          const raw = data.preRegisterChecklist;
          checklist = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
        } catch { /* ignore parse errors */ }
        setPreReg({
          preRegisterTitle: data.preRegisterTitle || 'Before You Start',
          preRegisterSubtitle: data.preRegisterSubtitle || '',
          preRegisterChecklist: checklist,
          requireInviteAcceptance: data.requireInviteAcceptance || false,
          captchaEnabled: data.captchaEnabled || false,
        });
      }
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    }
  };

  const fetchBlocks = async () => {
    try {
      const res = await fetch('/api/settings/onboarding');
      if (res.ok) {
        const data = await res.json();
        setBlocks(data.content || []);
      }
    } catch (e) {
      console.error('Failed to fetch onboarding:', e);
    }
  };

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

  const addBlock = (type: OnboardingBlock['type']) => {
    let newBlock: OnboardingBlock;
    switch (type) {
      case 'text':
        newBlock = { type: 'text', title: 'Section Title', content: 'Add your content here...' };
        break;
      case 'features':
        newBlock = { type: 'features', title: 'Getting Started', items: ['First step', 'Second step', 'Third step'] };
        break;
      case 'cta':
        newBlock = { type: 'cta', title: 'Ready to go?', content: 'Click below to get started.', buttonText: 'Get Started', buttonUrl: '/' };
        break;
      case 'image':
        newBlock = { type: 'image', imageUrl: '', imageCaption: '' };
        break;
      case 'apps':
        newBlock = { type: 'apps', title: 'Recommended Apps', apps: [
          { name: 'Jellyfin', description: 'Official media player', icon: '', url: 'https://jellyfin.org/downloads' },
        ]};
        break;
      case 'links':
        newBlock = { type: 'links', title: 'Useful Links', links: [
          { label: 'Server Status', url: '/', description: '' },
        ]};
        break;
      case 'divider':
        newBlock = { type: 'divider' };
        break;
      default:
        return;
    }
    setBlocks([...blocks, newBlock]);
    setShowSaveBar(true);
  };

  const updateBlock = (index: number, updates: Partial<OnboardingBlock>) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates };
    setBlocks(newBlocks);
    setShowSaveBar(true);
  };

  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
    setShowSaveBar(true);
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const newBlocks = [...blocks];
    const target = index + direction;
    [newBlocks[index], newBlocks[target]] = [newBlocks[target], newBlocks[index]];
    setBlocks(newBlocks);
    setShowSaveBar(true);
  };

  const addItem = (blockIndex: number) => {
    const block = blocks[blockIndex];
    if (block.type === 'features' && block.items) {
      updateBlock(blockIndex, { items: [...block.items, ''] });
    }
  };

  const updateItem = (blockIndex: number, itemIndex: number, value: string) => {
    const block = blocks[blockIndex];
    if (block.type === 'features' && block.items) {
      const newItems = [...block.items];
      newItems[itemIndex] = value;
      updateBlock(blockIndex, { items: newItems });
    }
  };

  const removeItem = (blockIndex: number, itemIndex: number) => {
    const block = blocks[blockIndex];
    if (block.type === 'features' && block.items) {
      updateBlock(blockIndex, { items: block.items.filter((_, i) => i !== itemIndex) });
    }
  };

  const setPreRegField = <K extends keyof PreRegSettings>(key: K, value: PreRegSettings[K]) => {
    setPreReg(prev => ({ ...prev, [key]: value }));
    setShowSaveBar(true);
  };

  const addChecklistItem = () => {
    setPreReg(prev => ({ ...prev, preRegisterChecklist: [...prev.preRegisterChecklist, ''] }));
    setShowSaveBar(true);
  };

  const updateChecklistItem = (index: number, value: string) => {
    setPreReg(prev => {
      const items = [...prev.preRegisterChecklist];
      items[index] = value;
      return { ...prev, preRegisterChecklist: items };
    });
    setShowSaveBar(true);
  };

  const removeChecklistItem = (index: number) => {
    setPreReg(prev => ({
      ...prev,
      preRegisterChecklist: prev.preRegisterChecklist.filter((_, i) => i !== index),
    }));
    setShowSaveBar(true);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Onboarding</h1>
          <p className={styles.subtitle}>Customize the user journey before and after registration</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </Button>
      </div>

      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'pre' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('pre')}
        >
          Pre-Registration
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'post' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('post')}
        >
          Post-Registration
        </button>
      </div>

      <div className={styles.layout}>
        <div className={styles.editorCol}>
          {activeTab === 'pre' ? (
            <div className={styles.formGrid}>
              <Input
                label="Page Title"
                value={preReg.preRegisterTitle}
                onChange={(e) => setPreRegField('preRegisterTitle', e.target.value)}
                hint="Title shown on invite acceptance page"
              />
              <Input
                label="Page Subtitle"
                value={preReg.preRegisterSubtitle}
                onChange={(e) => setPreRegField('preRegisterSubtitle', e.target.value)}
                hint="Supporting text below the title"
              />

              <div className={styles.checklistSection}>
                <div className={styles.checklistHeader}>
                  <div>
                    <h3 className={styles.sectionTitle}>Checklist Items</h3>
                    <p className={styles.sectionDescription}>Rules or expectations users must review</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={addChecklistItem}>+ Add Item</Button>
                </div>
                <div className={styles.checklistItems}>
                  {preReg.preRegisterChecklist.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p>No checklist items yet. Add items to show users before they register.</p>
                    </div>
                  ) : (
                    preReg.preRegisterChecklist.map((item, i) => (
                      <div key={i} className={styles.featureItem}>
                        <input
                          type="text"
                          placeholder="e.g. Do not share your account"
                          value={item}
                          onChange={(e) => updateChecklistItem(i, e.target.value)}
                        />
                        <button
                          className={styles.removeItem}
                          onClick={() => removeChecklistItem(i)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.toggleGroup}>
                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={preReg.requireInviteAcceptance}
                    onChange={(e) => setPreRegField('requireInviteAcceptance', e.target.checked)}
                  />
                  <span>Require invite acceptance</span>
                </label>
                <p className={styles.toggleHint}>Users must check a confirmation box before proceeding</p>
              </div>

              <div className={styles.toggleGroup}>
                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={preReg.captchaEnabled}
                    onChange={(e) => setPreRegField('captchaEnabled', e.target.checked)}
                  />
                  <span>Enable arithmetic CAPTCHA</span>
                </label>
                <p className={styles.toggleHint}>Simple math puzzle on the registration form</p>
              </div>
            </div>
          ) : (
          <>
          <div className={styles.formGrid}>
            <Input
              label="Page Title"
              value={settings.onboardingTitle}
              onChange={(e) => {
                setSettings({ ...settings, onboardingTitle: e.target.value });
                setShowSaveBar(true);
              }}
              hint="Main heading shown to new users"
            />
            <Input
              label="Page Subtitle"
              value={settings.onboardingSubtitle}
              onChange={(e) => {
                setSettings({ ...settings, onboardingSubtitle: e.target.value });
                setShowSaveBar(true);
              }}
              hint="Text below the title"
            />
            <div className={styles.twoColGrid}>
              <Input
                label="Button Text"
                value={settings.onboardingButtonText}
                onChange={(e) => {
                  setSettings({ ...settings, onboardingButtonText: e.target.value });
                  setShowSaveBar(true);
                }}
              />
              <Input
                label="Button URL"
                value={settings.onboardingButtonUrl}
                onChange={(e) => {
                  setSettings({ ...settings, onboardingButtonUrl: e.target.value });
                  setShowSaveBar(true);
                }}
                hint="Where to redirect (e.g. / or https://...)"
              />
            </div>
          </div>

          <div className={styles.blocksSection}>
            <div className={styles.blocksHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Content Blocks</h2>
                <p className={styles.sectionDescription}>Add and arrange content blocks</p>
              </div>
              <div className={styles.addBlockButtons}>
                <Button size="sm" variant="secondary" onClick={() => addBlock('text')}>+ Text</Button>
                <Button size="sm" variant="secondary" onClick={() => addBlock('features')}>+ Features</Button>
                <Button size="sm" variant="secondary" onClick={() => addBlock('cta')}>+ CTA</Button>
                <Button size="sm" variant="secondary" onClick={() => addBlock('apps')}>+ Apps</Button>
                <Button size="sm" variant="secondary" onClick={() => addBlock('links')}>+ Links</Button>
                <Button size="sm" variant="secondary" onClick={() => addBlock('image')}>+ Image</Button>
                <Button size="sm" variant="secondary" onClick={() => addBlock('divider')}>+ Divider</Button>
              </div>
            </div>

            <div className={styles.blocksList}>
              {blocks.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No onboarding content yet. Add blocks to customize the welcome message.</p>
                </div>
              ) : (
                blocks.map((block, index) => (
                  <div key={index} className={styles.blockEdit}>
                    <div className={styles.blockHeader}>
                      <div className={styles.blockHeaderLeft}>
                        <span className={styles.blockType}>
                          {{ text: 'Text', features: 'Feature List', cta: 'Call to Action', image: 'Image', divider: 'Divider', apps: 'Apps', links: 'Links' }[block.type]}
                        </span>
                        {index > 0 && (
                          <button className={styles.blockAction} onClick={() => moveBlock(index, -1)} title="Move up">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="18 15 12 9 6 15" />
                            </svg>
                          </button>
                        )}
                        {index < blocks.length - 1 && (
                          <button className={styles.blockAction} onClick={() => moveBlock(index, 1)} title="Move down">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <button className={styles.blockAction} onClick={() => removeBlock(index)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>

                    {block.type === 'divider' ? (
                      <div className={styles.dividerLine} />
                    ) : block.type === 'apps' ? (
                      <>
                        <input
                          type="text"
                          className={styles.blockInput}
                          placeholder="Section title (e.g. Recommended Apps)"
                          value={block.title || ''}
                          onChange={(e) => updateBlock(index, { title: e.target.value })}
                        />
                        <div className={styles.itemsList}>
                          {(block.apps || []).map((app, ai) => (
                            <div key={ai} className={styles.itemEdit}>
                              <div className={styles.twoColGrid}>
                                <input
                                  type="text"
                                  className={`${styles.blockInput} ${styles.noMargin}`}
                                  placeholder="App name"
                                  value={app.name}
                                  onChange={(e) => {
                                    const apps = [...(block.apps || [])];
                                    apps[ai] = { ...apps[ai], name: e.target.value };
                                    updateBlock(index, { apps });
                                  }}
                                />
                                <input
                                  type="text"
                                  className={`${styles.blockInput} ${styles.noMargin}`}
                                  placeholder="Download URL"
                                  value={app.url || ''}
                                  onChange={(e) => {
                                    const apps = [...(block.apps || [])];
                                    apps[ai] = { ...apps[ai], url: e.target.value };
                                    updateBlock(index, { apps });
                                  }}
                                />
                              </div>
                              <div className={styles.itemRow}>
                                <input
                                  type="text"
                                  className={`${styles.blockInput} ${styles.noMargin}`}
                                  placeholder="Short description"
                                  value={app.description || ''}
                                  onChange={(e) => {
                                    const apps = [...(block.apps || [])];
                                    apps[ai] = { ...apps[ai], description: e.target.value };
                                    updateBlock(index, { apps });
                                  }}
                                />
                                <button
                                  className={styles.removeItem}
                                  onClick={() => {
                                    const apps = (block.apps || []).filter((_, i) => i !== ai);
                                    updateBlock(index, { apps });
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                          <Button size="sm" variant="ghost" onClick={() => {
                            const apps = [...(block.apps || []), { name: '', description: '', icon: '', url: '' }];
                            updateBlock(index, { apps });
                          }}>
                            + Add App
                          </Button>
                        </div>
                      </>
                    ) : block.type === 'links' ? (
                      <>
                        <input
                          type="text"
                          className={styles.blockInput}
                          placeholder="Section title (e.g. Useful Links)"
                          value={block.title || ''}
                          onChange={(e) => updateBlock(index, { title: e.target.value })}
                        />
                        <div className={styles.itemsList}>
                          {(block.links || []).map((link, li) => (
                            <div key={li} className={styles.itemEdit}>
                              <div className={styles.threeColGrid}>
                                <input
                                  type="text"
                                  className={`${styles.blockInput} ${styles.noMargin}`}
                                  placeholder="Label"
                                  value={link.label}
                                  onChange={(e) => {
                                    const links = [...(block.links || [])];
                                    links[li] = { ...links[li], label: e.target.value };
                                    updateBlock(index, { links });
                                  }}
                                />
                                <input
                                  type="text"
                                  className={`${styles.blockInput} ${styles.noMargin}`}
                                  placeholder="URL"
                                  value={link.url}
                                  onChange={(e) => {
                                    const links = [...(block.links || [])];
                                    links[li] = { ...links[li], url: e.target.value };
                                    updateBlock(index, { links });
                                  }}
                                />
                                <button
                                  className={styles.removeItem}
                                  onClick={() => {
                                    const links = (block.links || []).filter((_, i) => i !== li);
                                    updateBlock(index, { links });
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                          <Button size="sm" variant="ghost" onClick={() => {
                            const links = [...(block.links || []), { label: '', url: '', description: '' }];
                            updateBlock(index, { links });
                          }}>
                            + Add Link
                          </Button>
                        </div>
                      </>
                    ) : block.type === 'image' ? (
                      <>
                        <input
                          type="text"
                          className={styles.blockInput}
                          placeholder="Image URL (https://...)"
                          value={block.imageUrl || ''}
                          onChange={(e) => updateBlock(index, { imageUrl: e.target.value })}
                        />
                        <input
                          type="text"
                          className={styles.blockInput}
                          placeholder="Caption (optional)"
                          value={block.imageCaption || ''}
                          onChange={(e) => updateBlock(index, { imageCaption: e.target.value })}
                        />
                      </>
                    ) : block.type === 'cta' ? (
                      <>
                        <input
                          type="text"
                          className={styles.blockInput}
                          placeholder="Block title"
                          value={block.title || ''}
                          onChange={(e) => updateBlock(index, { title: e.target.value })}
                        />
                        <textarea
                          className={styles.blockTextarea}
                          placeholder="Description text..."
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
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          className={styles.blockInput}
                          placeholder="Block title"
                          value={block.title || ''}
                          onChange={(e) => updateBlock(index, { title: e.target.value })}
                        />
                        {block.type === 'text' ? (
                          <textarea
                            className={styles.blockTextarea}
                            placeholder="Enter text content..."
                            value={block.content || ''}
                            onChange={(e) => updateBlock(index, { content: e.target.value })}
                          />
                        ) : (
                          <div className={styles.featureItems}>
                            {block.items?.map((item, itemIndex) => (
                              <div key={itemIndex} className={styles.featureItem}>
                                <input
                                  type="text"
                                  placeholder="Feature item"
                                  value={item}
                                  onChange={(e) => updateItem(index, itemIndex, e.target.value)}
                                />
                                <button
                                  className={styles.removeItem}
                                  onClick={() => removeItem(index, itemIndex)}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                            <Button size="sm" variant="ghost" onClick={() => addItem(index)}>
                              + Add Item
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          </>
          )}
        </div>

        {showPreview && (
          <div className={styles.previewCol}>
            <div className={styles.previewLabel}>Live Preview</div>
            <div className={styles.previewFrame}>
              <div className={styles.previewBg} />
              <div className={styles.previewContent}>
                {activeTab === 'pre' ? (
                  <>
                    <div className={styles.previewTitle}>{preReg.preRegisterTitle || 'Before You Start'}</div>
                    <div className={styles.previewSubtitle}>{preReg.preRegisterSubtitle || 'Review the requirements before creating your account.'}</div>

                    {preReg.preRegisterChecklist.filter(Boolean).length > 0 && (
                      <div className={styles.previewBlock}>
                        <div className={styles.previewFeatures}>
                          {preReg.preRegisterChecklist.filter(Boolean).map((item, j) => (
                            <div key={j} className={styles.previewFeatureItem}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {preReg.requireInviteAcceptance && (
                      <div className={styles.previewCheckbox}>
                        <div className={styles.previewCheckboxBox} />
                        <span>I understand and agree to the above</span>
                      </div>
                    )}

                    {preReg.captchaEnabled && (
                      <div className={styles.previewBlock}>
                        <div className={styles.previewBlockTitle}>Verification</div>
                        <div className={styles.previewBlockText}>Arithmetic CAPTCHA will appear on the registration form</div>
                      </div>
                    )}

                    <div className={styles.previewAction}>Continue</div>
                  </>
                ) : (
                  <>
                    <div className={styles.previewIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </div>
                    <div className={styles.previewTitle}>{settings.onboardingTitle || 'Welcome Aboard'}</div>
                    <div className={styles.previewSubtitle}>{settings.onboardingSubtitle || "Your account has been created."}</div>

                    <div className={styles.previewBlocks}>
                      {(blocks.length > 0 ? blocks : [
                        { type: 'features' as const, title: 'Getting Started', items: ['Your account is now active', 'Log in with your credentials', 'Browse and start watching'] },
                        { type: 'text' as const, title: 'Need Help?', content: 'Reach out to your server administrator.' },
                      ]).map((block, i) => (
                        <div key={i}>
                          {block.type === 'divider' ? (
                            <div className={styles.previewDivider} />
                          ) : block.type === 'image' ? (
                            <div className={styles.previewImageBlock}>
                              {block.imageUrl ? (
                                <img src={block.imageUrl} alt="" className={styles.previewImage} />
                              ) : (
                                <div className={styles.previewImagePlaceholder}>No image</div>
                              )}
                              {block.imageCaption && (
                                <div className={styles.previewImageCaption}>{block.imageCaption}</div>
                              )}
                            </div>
                          ) : (
                            <div className={styles.previewBlock}>
                              {block.title && <div className={styles.previewBlockTitle}>{block.title}</div>}
                              {block.type === 'text' && block.content && (
                                <div className={styles.previewBlockText}>{block.content}</div>
                              )}
                              {block.type === 'features' && block.items && (
                                <div className={styles.previewFeatures}>
                                  {block.items.filter(Boolean).map((item, j) => (
                                    <div key={j} className={styles.previewFeatureItem}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                      <span>{item}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {block.type === 'cta' && (
                                <>
                                  {block.content && <div className={styles.previewBlockText}>{block.content}</div>}
                                  {block.buttonText && (
                                    <div className={styles.previewCtaBtn}>{block.buttonText}</div>
                                  )}
                                </>
                              )}
                              {block.type === 'apps' && block.apps && block.apps.length > 0 && (
                                <div className={styles.previewAppsGrid}>
                                  {block.apps.map((app, j) => (
                                    <div key={j} className={styles.previewAppCard}>
                                      <div className={styles.previewAppIcon}>
                                        {app.icon ? (
                                          <img src={app.icon} alt={app.name} />
                                        ) : (
                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                                          </svg>
                                        )}
                                      </div>
                                      <div className={styles.previewAppInfo}>
                                        <span className={styles.previewAppName}>{app.name}</span>
                                        {app.description && <span className={styles.previewAppDesc}>{app.description}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {block.type === 'links' && block.links && block.links.length > 0 && (
                                <div className={styles.previewLinksList}>
                                  {block.links.map((link, j) => (
                                    <div key={j} className={styles.previewLinkItem}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                        <polyline points="15 3 21 3 21 9" />
                                        <line x1="10" y1="14" x2="21" y2="3" />
                                      </svg>
                                      <span>{link.label}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className={styles.previewAction}>
                      {settings.onboardingButtonText || 'Start Watching'}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showSaveBar && (
        <div className={styles.saveBar}>
          <span className={styles.saveBarText}>You have unsaved changes</span>
          <Button size="sm" onClick={handleSave} loading={saving}>
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
