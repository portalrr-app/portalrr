# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Portalrr, **please do not open a public issue**.

Instead, report it privately:

1. Go to the [Security Advisories](https://github.com/portalrr/portalrr/security/advisories) page
2. Click **"Report a vulnerability"**
3. Provide a description of the issue, steps to reproduce, and potential impact

## What Counts as a Security Issue

- Authentication or session bypasses
- SQL injection, XSS, CSRF, or other injection attacks
- Privilege escalation (user accessing admin routes, etc.)
- Secrets leaking in API responses or logs
- Encryption weaknesses
- Rate limiting bypasses that enable brute-force attacks

## What Doesn't Count

- Self-hosted misconfigurations (running without HTTPS, weak passwords, etc.)
- Denial of service against a single self-hosted instance
- Issues that require physical access to the host machine
- Bugs that don't have a security impact

## Response

We take security seriously and will:

1. Acknowledge your report within 48 hours
2. Provide an estimated timeline for a fix
3. Credit you in the release notes (unless you prefer to stay anonymous)

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
| Older   | No — please update to the latest version |
