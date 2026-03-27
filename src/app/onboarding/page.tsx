'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components';
import { useAppearance } from '@/hooks/useAppearance';
import styles from './page.module.css';

interface OnboardingBlock {
  type: 'text' | 'features' | 'cta' | 'image' | 'divider' | 'apps' | 'links';
  title?: string;
  content?: string;
  items?: string[];
  buttonText?: string;
  buttonUrl?: string;
  imageUrl?: string;
  imageCaption?: string;
  apps?: { name: string; description?: string; icon?: string; url?: string }[];
  links?: { label: string; url: string; description?: string }[];
}

interface OnboardingSettings {
  onboardingTitle: string;
  onboardingSubtitle: string;
  onboardingButtonText: string;
  onboardingButtonUrl: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { appearance } = useAppearance();
  const [blocks, setBlocks] = useState<OnboardingBlock[]>([]);
  const [settings, setSettings] = useState<OnboardingSettings>({
    onboardingTitle: 'Welcome Aboard',
    onboardingSubtitle: "Your account has been created. Here's everything you need to know to get started.",
    onboardingButtonText: 'Start Watching',
    onboardingButtonUrl: '/',
  });

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.onboardingTitle) setSettings({
          onboardingTitle: data.onboardingTitle,
          onboardingSubtitle: data.onboardingSubtitle || settings.onboardingSubtitle,
          onboardingButtonText: data.onboardingButtonText || settings.onboardingButtonText,
          onboardingButtonUrl: data.onboardingButtonUrl || settings.onboardingButtonUrl,
        });
      })
      .catch(console.error);

    fetch('/api/settings/onboarding')
      .then((res) => res.json())
      .then((data) => {
        if (data.content && data.content.length > 0) {
          setBlocks(data.content);
        } else {
          setBlocks(DEFAULT_BLOCKS);
        }
      })
      .catch(() => setBlocks(DEFAULT_BLOCKS));
  }, []);

  const handleComplete = () => {
    const url = settings.onboardingButtonUrl || '/';
    if (url.startsWith('https://') || url.startsWith('http://')) {
      window.location.href = url;
    } else if (url.startsWith('/')) {
      router.push(url);
    } else {
      router.push('/');
    }
  };

  return (
    <div
      className={styles.container}
      data-animations={appearance?.enableAnimations !== false ? 'on' : 'off'}
    >
      <div
        className={styles.background}
        data-bg-style={appearance?.backgroundStyle || 'gradient'}
        data-gradient-dir={appearance?.gradientDirection || 'top'}
        data-noise={appearance?.enableNoise !== false ? 'on' : 'off'}
        style={{
          ...(appearance?.backgroundStyle === 'image' && appearance?.backgroundImageUrl
            ? { backgroundImage: `url(${appearance.backgroundImageUrl})` }
            : {}),
          ...({ '--bg-overlay-opacity': appearance?.backgroundOverlay ?? 0.7 } as React.CSSProperties),
        }}
      />

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.icon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <h1 className={styles.title}>{settings.onboardingTitle}</h1>
          <p className={styles.subtitle}>{settings.onboardingSubtitle}</p>
        </div>

        <div className={styles.blocks}>
          {blocks.map((block, index) => (
            <OnboardingBlockRenderer key={index} block={block} />
          ))}
        </div>

        <div className={styles.actions}>
          <Button size="lg" onClick={handleComplete}>
            {settings.onboardingButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OnboardingBlockRenderer({ block }: { block: OnboardingBlock }) {
  if (block.type === 'divider') {
    return <div className={styles.divider} />;
  }

  if (block.type === 'image') {
    return (
      <div className={styles.imageBlock}>
        {block.imageUrl && (
          <img src={block.imageUrl} alt={block.imageCaption || ''} className={styles.blockImage} />
        )}
        {block.imageCaption && (
          <p className={styles.imageCaption}>{block.imageCaption}</p>
        )}
      </div>
    );
  }

  if (block.type === 'cta') {
    return (
      <div className={styles.ctaBlock}>
        {block.title && <h3 className={styles.blockTitle}>{block.title}</h3>}
        {block.content && <p className={styles.blockText}>{block.content}</p>}
        {block.buttonText && block.buttonUrl && (
          <a href={block.buttonUrl} className={styles.ctaButton} target="_blank" rel="noopener noreferrer">
            {block.buttonText}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </a>
        )}
      </div>
    );
  }

  if (block.type === 'text') {
    return (
      <div className={styles.block}>
        {block.title && <h3 className={styles.blockTitle}>{block.title}</h3>}
        {block.content && <p className={styles.blockText}>{block.content}</p>}
      </div>
    );
  }

  if (block.type === 'features') {
    return (
      <div className={styles.block}>
        {block.title && <h3 className={styles.blockTitle}>{block.title}</h3>}
        {block.items && (
          <ul>
            {block.items.map((item, i) => (
              <li key={i}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (block.type === 'apps') {
    return (
      <div className={styles.block}>
        {block.title && <h3 className={styles.blockTitle}>{block.title}</h3>}
        {block.apps && block.apps.length > 0 && (
          <div className={styles.appsGrid}>
            {block.apps.map((app, i) => (
              <a
                key={i}
                href={app.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.appCard}
              >
                <div className={styles.appIcon}>
                  {app.icon ? (
                    <img src={app.icon} alt={app.name} />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  )}
                </div>
                <div className={styles.appInfo}>
                  <span className={styles.appName}>{app.name}</span>
                  {app.description && (
                    <span className={styles.appDescription}>{app.description}</span>
                  )}
                </div>
                <svg className={styles.appArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (block.type === 'links') {
    return (
      <div className={styles.block}>
        {block.title && <h3 className={styles.blockTitle}>{block.title}</h3>}
        {block.links && block.links.length > 0 && (
          <div className={styles.linksList}>
            {block.links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.linkItem}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                <div>
                  <span className={styles.linkLabel}>{link.label}</span>
                  {link.description && (
                    <span className={styles.linkDescription}>{link.description}</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

const DEFAULT_BLOCKS: OnboardingBlock[] = [
  {
    type: 'features',
    title: 'Getting Started',
    items: [
      'Your account is now active and ready to use',
      'Log in to your media server with the credentials you just created',
      'Browse your libraries and start watching',
    ],
  },
  {
    type: 'text',
    title: 'Need Help?',
    content: 'If you have any questions or run into issues, reach out to your server administrator for assistance.',
  },
];
