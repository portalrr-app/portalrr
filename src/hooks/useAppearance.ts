'use client';

import { useEffect, useState } from 'react';

export type OnboardingParticleStyle = 'none' | 'constellation' | 'starfield' | 'orbs' | 'portals' | 'grid';
export type OnboardingFlowLayout = 'centered' | 'split' | 'immersive';
export type OnboardingFlowTransition = 'glide' | 'fade' | 'warp';

export interface AppearanceSettings {
  serverName: string;
  accentColor: string;
  customCss: string | null;
  appName: string;
  logoUrl: string | null;
  logoMode: string;
  subtitleText: string;
  backgroundStyle: string;
  backgroundImageUrl: string | null;
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
  footerText: string | null;
  hideAdminLink: boolean;
  buttonText: string;
  registerButtonText: string;
  // Onboarding flow visuals — apply across the whole onboarding journey
  onboardingParticleStyle?: OnboardingParticleStyle;
  onboardingParticleIntensity?: number;
  onboardingParticleCursor?: boolean;
  onboardingLayout?: OnboardingFlowLayout;
  onboardingTransition?: OnboardingFlowTransition;
  onboardingGlass?: boolean;
}

const RADIUS_MAP: Record<string, Record<string, string>> = {
  none: { '--radius-sm': '0px', '--radius-md': '0px', '--radius-lg': '0px', '--radius-xl': '0px' },
  small: { '--radius-sm': '4px', '--radius-md': '6px', '--radius-lg': '8px', '--radius-xl': '12px' },
  medium: { '--radius-sm': '6px', '--radius-md': '8px', '--radius-lg': '12px', '--radius-xl': '16px' },
  large: { '--radius-sm': '8px', '--radius-md': '12px', '--radius-lg': '16px', '--radius-xl': '24px' },
};

const FONT_MAP: Record<string, string> = {
  'dm-sans': "'DM Sans', system-ui, -apple-system, sans-serif",
  'inter': "'Inter', system-ui, -apple-system, sans-serif",
  'system': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  'mono': "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  'serif': "'Georgia', 'Times New Roman', serif",
};

const DISPLAY_FONT_MAP: Record<string, string> = {
  'same': '',
  'playfair': "'Playfair Display', serif",
  'space-grotesk': "'Space Grotesk', sans-serif",
  'outfit': "'Outfit', sans-serif",
};

const GOOGLE_FONT_URLS: Record<string, string> = {
  'inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'mono': 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap',
  'playfair': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
  'space-grotesk': 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
  'outfit': 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
};

function loadGoogleFont(key: string) {
  const url = GOOGLE_FONT_URLS[key];
  if (!url) return;
  const id = `portalrr-font-${key}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

function updateFavicon(accentColor: string) {
  const svg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="4" style="fill:${accentColor}"/>
    <rect x="7" y="7" width="10" height="10" rx="2.5" style="fill:#0A0A0A"/>
    <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" style="fill:${accentColor}"/>
  </svg>`;
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
  if (link) {
    link.href = dataUrl;
  }
}

export function useAppearance() {
  const [appearance, setAppearance] = useState<AppearanceSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/public')
      .then((res) => res.json())
      .then((data: AppearanceSettings) => {
        setAppearance(data);

        // Apply accent color
        if (data.accentColor) {
          const hex = data.accentColor;
          document.documentElement.style.setProperty('--accent', hex);
          document.documentElement.style.setProperty('--accent-hover', hex);
          document.documentElement.style.setProperty('--accent-muted', hex + '20');
          document.documentElement.style.setProperty('--accent-glow', hex + '30');
          updateFavicon(hex);
        }

        // Apply border radius
        const radii = RADIUS_MAP[data.borderRadius] || RADIUS_MAP.large;
        for (const [prop, value] of Object.entries(radii)) {
          document.documentElement.style.setProperty(prop, value);
        }

        // Apply fonts
        if (data.fontFamily && FONT_MAP[data.fontFamily]) {
          loadGoogleFont(data.fontFamily);
          document.documentElement.style.setProperty('--font-body', FONT_MAP[data.fontFamily]);
        }
        if (data.fontDisplay && data.fontDisplay !== 'same' && DISPLAY_FONT_MAP[data.fontDisplay]) {
          loadGoogleFont(data.fontDisplay);
          document.documentElement.style.setProperty('--font-display', DISPLAY_FONT_MAP[data.fontDisplay]);
        } else {
          document.documentElement.style.setProperty('--font-display', 'var(--font-body)');
        }

        // Apply animations toggle
        if (!data.enableAnimations) {
          document.documentElement.style.setProperty('--transition-fast', '0ms');
          document.documentElement.style.setProperty('--transition-base', '0ms');
          document.documentElement.style.setProperty('--transition-slow', '0ms');
        }

        // Inject custom CSS (sanitized to prevent hiding branding)
        if (data.customCss) {
          let styleEl = document.getElementById('portalrr-custom-css');
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'portalrr-custom-css';
            document.head.appendChild(styleEl);
          }
          styleEl.textContent = data.customCss;
        }

        // Protect branding elements from being hidden
        requestAnimationFrame(() => {
          document.querySelectorAll('[data-portalrr-branding]').forEach((el) => {
            const s = (el as HTMLElement).style;
            s.setProperty('display', 'flex', 'important');
            s.setProperty('visibility', 'visible', 'important');
            s.setProperty('opacity', '0.3', 'important');
            s.setProperty('position', 'absolute', 'important');
            s.setProperty('pointer-events', 'auto', 'important');
          });
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { appearance, loading };
}
