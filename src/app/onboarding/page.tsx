'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FlowBackground from '@/components/FlowBackground';
import { useAppearance } from '@/hooks/useAppearance';
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

interface Settings {
  onboardingTitle: string;
  onboardingSubtitle: string;
  onboardingButtonText: string;
  onboardingButtonUrl: string;
}

type StepKey = 'welcome' | 'apps' | 'guides' | 'ready';
interface StepMeta { key: StepKey; phase: string; label: string }

export default function OnboardingPage() {
  const router = useRouter();
  const { appearance } = useAppearance();
  const [blocks, setBlocks] = useState<OnboardingBlock[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [warping, setWarping] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    onboardingTitle: 'Welcome Aboard',
    onboardingSubtitle: "Your account has been created. Here's everything you need to know to get started.",
    onboardingButtonText: 'Start Watching',
    onboardingButtonUrl: '/',
  });

  useEffect(() => {
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((data) => {
        setSettings((prev) => ({
          onboardingTitle: data.onboardingTitle || prev.onboardingTitle,
          onboardingSubtitle: data.onboardingSubtitle || prev.onboardingSubtitle,
          onboardingButtonText: data.onboardingButtonText || prev.onboardingButtonText,
          onboardingButtonUrl: data.onboardingButtonUrl || prev.onboardingButtonUrl,
        }));
      })
      .catch(console.error);

    fetch('/api/settings/onboarding')
      .then((r) => r.json())
      .then((data) => {
        const content: OnboardingBlock[] = data.content && data.content.length > 0 ? data.content : DEFAULT_BLOCKS;
        setBlocks(content);
      })
      .catch(() => setBlocks(DEFAULT_BLOCKS));
  }, []);

  const appsBlocks = useMemo(() => blocks.filter((b) => b.type === 'apps'), [blocks]);
  const guideBlocks = useMemo(
    () => blocks.filter((b) => b.type !== 'apps' && b.type !== 'cta' && b.type !== 'divider'),
    [blocks],
  );
  const ctaBlocks = useMemo(() => blocks.filter((b) => b.type === 'cta'), [blocks]);

  const steps: StepMeta[] = useMemo(() => {
    const s: StepMeta[] = [{ key: 'welcome', phase: 'Onboard', label: 'Welcome' }];
    if (appsBlocks.length > 0) s.push({ key: 'apps', phase: 'Onboard', label: 'Apps' });
    if (guideBlocks.length > 0) s.push({ key: 'guides', phase: 'Onboard', label: 'Guides' });
    s.push({ key: 'ready', phase: 'Onboard', label: 'Ready' });
    return s;
  }, [appsBlocks.length, guideBlocks.length]);

  const current = steps[stepIdx] ?? steps[0];

  const go = (delta: 1 | -1) => {
    const next = Math.max(0, Math.min(steps.length - 1, stepIdx + delta));
    if (next === stepIdx) return;
    setDir(delta);
    setStepIdx(next);
  };
  const jumpTo = (i: number) => {
    if (i === stepIdx) return;
    setDir(i > stepIdx ? 1 : -1);
    setStepIdx(i);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' && stepIdx > 0) go(-1);
      if (e.key === 'ArrowRight' && stepIdx < steps.length - 1) go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepIdx, steps.length]);

  const handleComplete = () => {
    const url = settings.onboardingButtonUrl || '/';
    const navigate = () => {
      if (url.startsWith('https://') || url.startsWith('http://')) {
        window.location.href = url;
      } else if (url.startsWith('/')) {
        router.push(url);
      } else {
        router.push('/');
      }
    };
    if (appearance?.onboardingTransition === 'warp' && appearance?.enableAnimations !== false) {
      setWarping(true);
      setTimeout(navigate, 650);
    } else {
      navigate();
    }
  };

  const accent = appearance?.accentColor || '#A78BFA';
  const particleActive = appearance?.onboardingParticleStyle && appearance.onboardingParticleStyle !== 'none';

  return (
    <div
      className={styles.app}
      data-animations={appearance?.enableAnimations !== false ? 'on' : 'off'}
      data-layout={appearance?.onboardingLayout || 'centered'}
      data-glass={appearance?.onboardingGlass ? 'on' : 'off'}
      data-transition={appearance?.onboardingTransition || 'glide'}
      data-noise={appearance?.enableNoise !== false ? 'on' : 'off'}
    >
      {particleActive && (
        <FlowBackground
          visuals={{
            onboardingParticleStyle: appearance?.onboardingParticleStyle,
            onboardingParticleIntensity: appearance?.onboardingParticleIntensity,
            onboardingParticleCursor: appearance?.onboardingParticleCursor,
          }}
          accent={accent}
          noise={appearance?.enableNoise !== false}
        />
      )}
      {!particleActive && <div className={styles.gradientBg} />}

      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <ellipse cx="12" cy="12" rx="4" ry="9" />
              <ellipse cx="12" cy="12" rx="9" ry="4" />
            </svg>
          </div>
          <div className={styles.brandText}>
            <div className={styles.brandName}>{appearance?.appName || 'Portalrr'}</div>
            <div className={styles.brandSub}>Setup complete</div>
          </div>
        </div>
        <div className={styles.phaseTag}>
          <span className={styles.phaseDot} />
          {current.phase} · {String(stepIdx + 1).padStart(2, '0')}/{String(steps.length).padStart(2, '0')}
        </div>
      </header>

      <nav className={styles.stepper} aria-label="Progress">
        {steps.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={`${styles.pip} ${i === stepIdx ? styles.pipCurrent : ''} ${i < stepIdx ? styles.pipDone : ''}`}
            onClick={() => jumpTo(i)}
            aria-label={`Step ${i + 1}: ${s.label}`}
          >
            <span className={styles.pipPhase}>{s.phase}</span>
            <span className={styles.pipLabel}>{s.label}</span>
            <span className={styles.pipBar}><span className={styles.pipFill} /></span>
          </button>
        ))}
      </nav>

      <main className={styles.stage}>
        <div
          className={`${styles.stageCard} ${warping ? styles.warping : ''}`}
          key={stepIdx}
          data-dir={dir}
        >
          {current.key === 'welcome' && <StepWelcome settings={settings} appName={appearance?.appName || 'Portalrr'} />}
          {current.key === 'apps' && <StepApps apps={appsBlocks} onBack={() => go(-1)} onContinue={() => go(1)} />}
          {current.key === 'guides' && <StepGuides blocks={guideBlocks} onBack={() => go(-1)} onContinue={() => go(1)} />}
          {current.key === 'ready' && (
            <StepReady
              ctaText={settings.onboardingButtonText}
              ctaBlocks={ctaBlocks}
              onBack={() => go(-1)}
              onComplete={handleComplete}
            />
          )}
        </div>
      </main>

      {warping && <div className={styles.warpOverlay} aria-hidden="true" />}
    </div>
  );
}

function StepWelcome({ settings, appName }: { settings: Settings; appName: string }) {
  return (
    <div className={styles.paneCenter}>
      <div className={styles.emblem} aria-hidden="true">
        <span className={styles.emblemRing} />
        <span className={`${styles.emblemRing} ${styles.emblemRing2}`} />
        <div className={styles.emblemCore}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="12" rx="4" ry="9" />
            <ellipse cx="12" cy="12" rx="9" ry="4" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </div>
      </div>
      <div className={styles.kicker}>Account created</div>
      <h1 className={styles.displayTitle}>{settings.onboardingTitle}</h1>
      <p className={styles.displaySub}>{settings.onboardingSubtitle}</p>
      <div className={styles.welcomeMeta}>
        <span className={styles.chip}>
          <span className={styles.chipDot} /> Server online
        </span>
        <span className={`${styles.chip} ${styles.chipGhost}`}>4K · HDR · Atmos</span>
        <span className={`${styles.chip} ${styles.chipGhost}`}>{appName}</span>
      </div>
    </div>
  );
}

function StepApps({
  apps,
  onBack,
  onContinue,
}: {
  apps: OnboardingBlock[];
  onBack: () => void;
  onContinue: () => void;
}) {
  const first = apps[0];
  const title = first?.title || 'Install a client';
  const items = apps.flatMap((b) => b.apps || []);
  return (
    <div className={styles.paneLeft}>
      <div className={styles.kicker}>Step · Get the apps</div>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={styles.sectionSub}>
        Sign in with the credentials you just created — the server will show up automatically.
      </p>
      <div className={styles.appsGrid}>
        {items.map((app, i) => (
          <a
            key={`${app.name}-${i}`}
            href={app.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.appTile}
            style={{ ['--tile-delay' as string]: `${i * 60}ms` }}
          >
            <div className={styles.appIcon}>
              {app.icon ? (
                <img src={app.icon} alt={app.name} />
              ) : (
                <span className={styles.appInitial}>{app.name[0]?.toUpperCase() || '?'}</span>
              )}
            </div>
            <div className={styles.appBody}>
              <div className={styles.appName}>{app.name}</div>
              {app.description && <div className={styles.appDesc}>{app.description}</div>}
            </div>
            <div className={styles.appAction}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
          </a>
        ))}
      </div>
      <div className={styles.ctaRow}>
        <button type="button" className={styles.ghostBtn} onClick={onBack}>Back</button>
        <button type="button" className={styles.ctaPrimary} onClick={onContinue}>
          Continue <IconArrow />
        </button>
      </div>
    </div>
  );
}

function StepGuides({
  blocks,
  onBack,
  onContinue,
}: {
  blocks: OnboardingBlock[];
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className={styles.paneLeft}>
      <div className={styles.kicker}>Step · Short manual</div>
      <h2 className={styles.sectionTitle}>Stuff worth knowing.</h2>
      <p className={styles.sectionSub}>A few things that make the experience nicer.</p>

      <div className={styles.guides}>
        {blocks.map((block, i) => (
          <GuideBlock key={i} block={block} index={i} />
        ))}
      </div>

      <div className={styles.ctaRow}>
        <button type="button" className={styles.ghostBtn} onClick={onBack}>Back</button>
        <button type="button" className={styles.ctaPrimary} onClick={onContinue}>
          Continue <IconArrow />
        </button>
      </div>
    </div>
  );
}

function GuideBlock({ block, index }: { block: OnboardingBlock; index: number }) {
  const style = { ['--g-delay' as string]: `${index * 70}ms` } as React.CSSProperties;

  if (block.type === 'text') {
    return (
      <div className={styles.guide} style={style}>
        <div className={styles.guideIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          {block.title && <div className={styles.guideTitle}>{block.title}</div>}
          {block.content && <div className={styles.guideBody}>{block.content}</div>}
        </div>
      </div>
    );
  }

  if (block.type === 'features') {
    return (
      <div className={styles.guide} style={style}>
        <div className={styles.guideIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          {block.title && <div className={styles.guideTitle}>{block.title}</div>}
          {block.items && (
            <ul className={styles.guideList}>
              {block.items.filter(Boolean).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (block.type === 'links') {
    return (
      <div className={styles.guide} style={style}>
        <div className={styles.guideIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </div>
        <div>
          {block.title && <div className={styles.guideTitle}>{block.title}</div>}
          {block.links && (
            <ul className={styles.guideList}>
              {block.links.map((link, i) => (
                <li key={i}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className={styles.guideLink}>
                    {link.label}
                  </a>
                  {link.description && <span> — {link.description}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (block.type === 'image') {
    return (
      <div className={styles.guide} style={style}>
        <div className={styles.guideFullImage}>
          {block.imageUrl && <img src={block.imageUrl} alt={block.imageCaption || ''} />}
          {block.imageCaption && <div className={styles.guideCaption}>{block.imageCaption}</div>}
        </div>
      </div>
    );
  }

  return null;
}

function StepReady({
  ctaText,
  ctaBlocks,
  onBack,
  onComplete,
}: {
  ctaText: string;
  ctaBlocks: OnboardingBlock[];
  onBack: () => void;
  onComplete: () => void;
}) {
  return (
    <div className={styles.paneCenter}>
      <div className={styles.readySpark}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
        </svg>
      </div>
      <h2 className={styles.displayTitle}>You&apos;re all set.</h2>
      <p className={styles.displaySub}>Step through the portal and start watching.</p>

      {ctaBlocks.length > 0 && (
        <div className={styles.readyExtras}>
          {ctaBlocks.map((block, i) => (
            <div key={i} className={styles.ctaBlock}>
              {block.title && <div className={styles.ctaBlockTitle}>{block.title}</div>}
              {block.content && <div className={styles.ctaBlockText}>{block.content}</div>}
              {block.buttonText && block.buttonUrl && (
                <a href={block.buttonUrl} target="_blank" rel="noopener noreferrer" className={styles.ghostLink}>
                  {block.buttonText} <IconExternal />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.ctaRow}>
        <button type="button" className={styles.ghostBtn} onClick={onBack}>Back</button>
        <button type="button" className={styles.ctaPrimary} onClick={onComplete}>
          {ctaText} <IconArrow />
        </button>
      </div>
    </div>
  );
}

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

const DEFAULT_BLOCKS: OnboardingBlock[] = [
  {
    type: 'apps',
    title: 'Install a client',
    apps: [
      { name: 'Plex', description: 'iOS · Android · TV · Web', url: 'https://plex.tv/apps' },
      { name: 'Infuse', description: 'iOS · macOS · tvOS', url: 'https://firecore.com/infuse' },
      { name: 'Jellyfin', description: 'All platforms · FOSS', url: 'https://jellyfin.org/downloads' },
    ],
  },
  {
    type: 'features',
    title: 'Getting started',
    items: [
      'Sign in with the credentials you just created',
      'Browse your libraries and start watching',
      'Request missing titles from your admin',
    ],
  },
  {
    type: 'text',
    title: 'Need help?',
    content: 'Reach out to your server administrator for assistance.',
  },
];
