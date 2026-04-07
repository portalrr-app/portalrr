#!/bin/sh
set -e

# Security warnings
if [ "$INSECURE_COOKIES" = "true" ] && [ "$NODE_ENV" = "production" ]; then
  echo "WARNING: INSECURE_COOKIES=true in production. Session cookies will be sent over HTTP. Only use this on trusted LANs behind a reverse proxy."
fi

if [ -z "$ENCRYPTION_KEY" ]; then
  echo "ERROR: ENCRYPTION_KEY is required. Server tokens, API keys, and SMTP credentials cannot be stored securely without it."
  echo "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  exit 1
fi

# Run database migrations
node node_modules/prisma/build/index.js migrate deploy

# Start the application
exec "$@"
