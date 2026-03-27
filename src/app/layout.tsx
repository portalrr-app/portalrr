import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portalrr - Media Server Invite Manager",
  description: "Invite management for Plex and Jellyfin servers",
  icons: {
    icon: "/icon.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var getContrastColor = function(hex) {
                  var r = parseInt(hex.slice(1, 3), 16);
                  var g = parseInt(hex.slice(3, 5), 16);
                  var b = parseInt(hex.slice(5, 7), 16);
                  var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                  return luminance > 0.55 ? '#000000' : '#ffffff';
                };
                var applyColor = function(color) {
                  document.documentElement.style.setProperty('--accent', color);
                  document.documentElement.style.setProperty('--accent-hover', color);
                  document.documentElement.style.setProperty('--accent-muted', color + '18');
                  document.documentElement.style.setProperty('--accent-glow', color + '2d');
                  document.documentElement.style.setProperty('--accent-contrast', getContrastColor(color));
                  var svg = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="4" style="fill:' + color + '"/><rect x="7" y="7" width="10" height="10" rx="2.5" style="fill:#0A0A0A"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.5" style="fill:' + color + '"/></svg>';
                  var dataUrl = 'data:image/svg+xml,' + encodeURIComponent(svg);
                  var iconLink = document.querySelector("link[rel='icon']");
                  if (iconLink) iconLink.href = dataUrl;
                };
                var setCookie = function(cookieStr) {
                  document.cookie = cookieStr + '; path=/; max-age=31536000; SameSite=Lax';
                };
                try {
                  // Apply cookie color immediately to avoid flash
                  var match = document.cookie.match(/accent_color=([^;]+)/);
                  if (match) {
                    try {
                      var cookieData = JSON.parse(decodeURIComponent(match[1]));
                      if (cookieData.color) applyColor(cookieData.color);
                    } catch(e) { applyColor(decodeURIComponent(match[1])); }
                  }
                  // Always fetch DB value — it's the source of truth
                  fetch('/api/settings/public').then(function(res) { return res.json(); }).then(function(data) {
                    if (data.accentColor) applyColor(data.accentColor);
                  }).catch(function() {});
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
