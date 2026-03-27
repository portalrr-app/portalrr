export const FONT_MAP: Record<string, string> = {
  'dm-sans': "'DM Sans', system-ui, -apple-system, sans-serif",
  'inter': "'Inter', system-ui, -apple-system, sans-serif",
  'system': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  'mono': "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  'serif': "'Georgia', 'Times New Roman', serif",
};

export const DISPLAY_FONT_MAP: Record<string, string> = {
  'same': '',
  'playfair': "'Playfair Display', serif",
  'space-grotesk': "'Space Grotesk', sans-serif",
  'outfit': "'Outfit', sans-serif",
};

export const GOOGLE_FONT_URLS: Record<string, string> = {
  'inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'mono': 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap',
  'playfair': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
  'space-grotesk': 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
  'outfit': 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
};

export const FONT_LABELS: Record<string, string> = {
  'dm-sans': 'DM Sans',
  'inter': 'Inter',
  'system': 'System',
  'mono': 'Monospace',
  'serif': 'Serif',
};

export const DISPLAY_FONT_LABELS: Record<string, string> = {
  'same': 'Same as Body',
  'playfair': 'Playfair Display',
  'space-grotesk': 'Space Grotesk',
  'outfit': 'Outfit',
};

export function loadGoogleFont(key: string): void {
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

export function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#000000' : '#ffffff';
}

export function applyAccentColor(color: string): void {
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-hover', color);
  document.documentElement.style.setProperty('--accent-muted', color + '18');
  document.documentElement.style.setProperty('--accent-glow', color + '2d');
  document.documentElement.style.setProperty('--accent-contrast', getContrastColor(color));
}

export function applyFonts(fontFamily?: string, fontDisplay?: string): void {
  if (fontFamily && FONT_MAP[fontFamily]) {
    loadGoogleFont(fontFamily);
    document.documentElement.style.setProperty('--font-body', FONT_MAP[fontFamily]);
  }
  if (fontDisplay && fontDisplay !== 'same' && DISPLAY_FONT_MAP[fontDisplay]) {
    loadGoogleFont(fontDisplay);
    document.documentElement.style.setProperty('--font-display', DISPLAY_FONT_MAP[fontDisplay]);
  } else if (fontDisplay === 'same' || !fontDisplay) {
    document.documentElement.style.setProperty('--font-display', 'var(--font-body)');
  }
}
