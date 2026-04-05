# Contributing to Portalrr

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
git clone https://github.com/portalrr/portalrr.git
cd portalrr
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

The dev server runs at `http://localhost:3939` with hot reload.

### Test Environment

For testing with a real media server, use the included test compose file:

```bash
docker compose -f docker-compose.test.yml up -d
```

This spins up Portalrr alongside a throwaway Jellyfin instance.

## Project Structure

```
src/
  app/
    api/            # API route handlers
    admin/          # Admin panel pages
    ...             # Public pages (invite, register, account, onboarding)
  components/       # Reusable UI components
  hooks/            # React hooks
  lib/              # Core logic
    auth/           # Session & auth middleware
    servers/        # Jellyfin, Plex, Jellyseerr clients
    notifications/  # Email, webhooks, Discord, Telegram
prisma/
  schema.prisma     # Database schema
```

## Code Style

- **TypeScript** everywhere — no `any` unless absolutely necessary
- **CSS Modules** for styling — no inline styles in components, no Tailwind
- **Zod** validation on every API endpoint that accepts input
- **No external UI libraries** — all components are built in-house
- Keep files focused — if a file is getting long, split it into sections or extract a module

## Making Changes

### Before You Start

1. **Open an issue first** to discuss the change — this avoids duplicate work and lets us align on approach
2. **Check existing issues** — someone might already be working on it

### Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run the tests: `npm test`
4. Run the linter: `npm run lint`
5. Test your changes manually in the browser
6. Open a pull request

### Branch Naming

Use descriptive branch names:
- `fix/invite-expiry-calculation`
- `feature/matrix-integration`
- `docs/update-faq`

### Commit Messages

Keep them short and descriptive. Start with a verb:
- `Fix invite race condition on concurrent redemptions`
- `Add Telegram bot notification support`
- `Update README with Docker Compose example`

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Include a description of what changed and why
- Add screenshots for UI changes
- Make sure tests pass before requesting review
- Don't include unrelated changes (formatting, refactoring) in the same PR

## Database Changes

If you modify `prisma/schema.prisma`:

1. Create a migration: `npx prisma migrate dev --name describe-your-change`
2. Include the migration file in your PR
3. Make sure the migration is backwards-compatible when possible

## Adding API Routes

- Add Zod validation for all inputs
- Use the auth helpers from `src/lib/auth/`
- Add rate limiting on sensitive endpoints
- Never return secrets (tokens, passwords, API keys) in responses
- Add an audit log entry for security-relevant actions

## Adding Components

- Use CSS Modules (create a `.module.css` file alongside the component)
- Use CSS custom properties (`var(--accent)`, `var(--bg-surface)`, etc.) for theming
- Support the appearance settings where relevant (border radius, button style, etc.)
- Keep components generic and reusable

## Questions?

If you're unsure about anything, open an issue or start a discussion. We're happy to help.
