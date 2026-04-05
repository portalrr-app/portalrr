# FAQ

## General

**What is Portalrr?**
A self-hosted portal for managing invites to your Plex or Jellyfin media server. You create invite links, users register through them, and Portalrr creates their account on your server with the right permissions.

**How is it different from Wizarr or JFA-GO?**
Portalrr is built around customization. You get 30+ theme options, a block-based onboarding editor, pre-registration flows, and full CSS control — so your invite portal looks like it belongs to your server, not a generic tool. It also has a modern stack (Next.js, TypeScript) that's easier to contribute to.

**Does it cost anything?**
No. Portalrr is free and open-source under the MIT license.

**What servers does it support?**
Jellyfin and Plex. Both support user creation, library management, and credential sync. Jellyfin has deeper integration (activity streams, admin auto-detection, live TV toggles).

---

## Setup

**How do I install Portalrr?**
The easiest way is Docker:
```bash
docker compose up -d
```
Then open `http://localhost:3939`. A setup wizard walks you through creating your admin account and connecting your server.

**What database does it use?**
SQLite. No separate database server needed — it's a single file stored in the data volume. Zero configuration.

**Do I need to set an encryption key?**
An `ENCRYPTION_KEY` is used to encrypt secrets (API keys, tokens) at rest. If you don't set one, it's auto-generated on first run and stored in the database directory. If you're migrating or backing up, keep this key — without it, encrypted values can't be decrypted.

**Can I run it behind a reverse proxy?**
Yes. Portalrr works behind Nginx, Caddy, Traefik, etc. Just proxy to port 3939. If you're using HTTPS (recommended), the session cookies are secure by default. If you need to run without HTTPS in development, set `INSECURE_COOKIES=true`.

**Can I connect multiple servers?**
Yes. Add as many Plex and Jellyfin servers as you want. Each invite targets a specific server.

---

## Invites

**What types of invite codes can I create?**
Three types:
- **Random** — alphanumeric codes like `a8f3k2`
- **PIN** — short numeric codes like `4829` (easy to share verbally)
- **Custom** — any code you choose like `movie-night`

**Can I protect an invite with a passphrase?**
Yes. Enable passphrase protection when creating an invite. The user will need to enter the passphrase before they can register.

**What happens when an invite expires?**
The invite link stops working. Users who already registered through it keep their accounts. You can configure per-user expiry separately.

**Can users request an invite without having one?**
Yes. Enable invite requests in Settings. Users submit a request form, and you approve or deny from the admin panel. Approved requests auto-generate an invite.

**Can existing users invite others?**
Yes. Enable the referral system in Settings. Users can generate their own invite links from their account page, with configurable limits on uses, expiry, and access duration.

---

## Users

**Where do users come from?**
Users are created when someone registers through an invite link. Portalrr creates their account on the target media server and tracks them locally.

**Can I import existing users from my server?**
Yes. Go to Users and use the import feature to pull in users that already exist on your Jellyfin or Plex server.

**What happens when a user's access expires?**
Depends on your expiry policy (Settings > User Lifecycle):
- **Disable** — account is disabled but kept
- **Delete** — account is removed from both Portalrr and the media server
- **Disable then delete** — disabled first, deleted after a configurable grace period

**Can I disable a user without deleting them?**
Yes. Disable from the user list. You can add a reason, and the user gets an email notification if configured. Re-enable anytime.

---

## Admin

**Can I have multiple admin accounts?**
Yes. Create additional admins from Admin Accounts in the sidebar.

**My Jellyfin admin account doesn't work for Portalrr login?**
Enable "Media Server Admin Login" in Settings > Security. Once enabled, any Jellyfin admin or Plex server owner can log into Portalrr's admin panel with their media server credentials.

**I forgot my admin password. How do I reset it?**
If you have another admin account, they can reset your password. If you're locked out entirely, delete the SQLite database file and restart — you'll get the setup wizard again. (Back up your data first if you need to preserve it.)

**What is 2FA and how do I set it up?**
Two-factor authentication adds a second step to login using an authenticator app (Google Authenticator, Authy, etc.). Set it up from My Account in the sidebar. Each admin manages their own 2FA independently.

---

## Customization

**How much can I customize the look?**
Everything. Accent color, fonts (body + display), card styles, border radius, background (solid, gradient, or image with overlay), button and input styles, animations, noise texture, gradient direction, custom welcome text, logo, footer, and raw CSS injection. There are also one-click presets to start from.

**Can I customize what users see before and after registration?**
Yes. The Onboarding page in the admin panel has two tabs:
- **Pre-Registration** — title, subtitle, checklist items, acceptance checkbox, CAPTCHA toggle
- **Post-Registration** — block-based editor with text, features, apps, links, images, CTAs, and dividers

Both have live previews.

**Can I add my own CSS?**
Yes. The Appearance page has a custom CSS field. Your CSS is injected into all public-facing pages.

---

## Notifications

**What notification channels are supported?**
- **Email** — via SMTP with customizable Markdown templates
- **Webhooks** — Discord embeds or generic JSON with HMAC signing
- **Discord bot** — role assignment and channel notifications
- **Telegram bot** — event notifications to a chat

**What events can trigger notifications?**
14 event types: user registered, disabled, enabled, deleted, expired, invite created, used, expired, request created/approved/denied, announcement sent, admin login, password reset.

**Can I customize email templates?**
Yes. Six template types (welcome, password reset, invite expiry, account expiry, account disabled, announcement) with Markdown formatting, variable substitution, conditional blocks, and live preview.

---

## Integrations

**How do I connect Jellyseerr/Overseerr?**
Add the URL and API key in Settings > Integrations. You'll see a Requests page in the sidebar where you can view, approve, and decline media requests.

**How does the Discord bot work?**
Add your bot token and guild ID in Settings > Discord Bot. The bot can:
- Automatically assign a role when a user registers
- Post notifications to a channel for events you choose
- Test the connection from the settings page

**How does the Telegram bot work?**
Create a bot via @BotFather, add the token and chat ID in Settings > Telegram Bot. It posts event notifications to the configured chat.

---

## Troubleshooting

**The app won't start / shows a blank page.**
Check that the `DATABASE_URL` path is writable and the data directory exists. In Docker, make sure the volume is mounted correctly.

**Users can't register — "Invalid invite" error.**
The invite may be expired, used up, or targeting a server that's been disconnected. Check the invite status in the admin panel.

**I changed the accent color to white and can't read button text.**
This is handled automatically — Portalrr computes contrast-aware text colors. If you're seeing this on an older cached version, hard-refresh the page (Ctrl+Shift+R).

**Media server connection test fails.**
Verify the URL is reachable from wherever Portalrr is running (not just your browser). For Jellyfin, check the API key in Dashboard > API Keys. For Plex, make sure the token is valid.

**How do I back up my data?**
Two options:
1. **Admin panel** — Settings > Backup & Restore. Export a JSON file with selected data (settings, invites, users, webhooks, templates, announcements). Sensitive data like passwords and API keys are stripped.
2. **File-level** — Copy the SQLite database file from the data directory. This preserves everything including encrypted secrets (you'll need the same `ENCRYPTION_KEY` to decrypt).
