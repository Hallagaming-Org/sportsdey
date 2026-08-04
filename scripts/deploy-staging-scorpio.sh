#!/usr/bin/env bash
# Deploy Scorpio-capable API + dual-lobby web to staging.
# Requires: wrangler auth (npx wrangler login) OR CLOUDFLARE_API_TOKEN in env.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="$ROOT/apps/server"
WEB="$ROOT/apps/web"
DEV_VARS="$SERVER/.dev.vars"

echo "==> Checking Cloudflare auth..."
if ! (cd "$SERVER" && npx wrangler whoami 2>&1 | tee /tmp/wrangler-whoami.txt | grep -qiE 'logged in|email|Account'); then
  if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    echo "ERROR: Not authenticated to Cloudflare."
    echo "Run:  cd apps/server && npx wrangler login"
    echo "Or:   export CLOUDFLARE_API_TOKEN=..."
    exit 1
  fi
  echo "Using CLOUDFLARE_API_TOKEN from environment."
fi

upload_secret() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "  skip $name (empty)"
    return
  fi
  echo "  secret: $name"
  printf '%s' "$value" | (cd "$SERVER" && npx wrangler secret put "$name" --env staging)
}

if [[ -f "$DEV_VARS" ]]; then
  echo "==> Syncing SCORPIO_* + SMS-bridge secrets from .dev.vars to staging..."
  # shellcheck disable=SC1090
  set -a
  # Parse KEY=VALUE without sourcing blindly (avoid executing)
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    case "$key" in
      SCORPIO_API_URL|SCORPIO_BASE_URL|SCORPIO_API_TOKEN|SCORPIO_CALLBACK_URL|SCORPIO_SERVER_IP|SCORPIO_ALLOWED_IPS|AFRICASTALKING_API_KEY|AFRICASTALKING_USERNAME|AFRICASTALKING_SENDER_ID|WEBENGAGE_API_SECRET|WEBENGAGE_DSN_URL|AT_DLR_SECRET|WEBENGAGE_API_KEY|WEBENGAGE_LICENSE_CODE|WEBENGAGE_HOST)
        # Prefer staging callback URL if still pointing at prod
        if [[ "$key" == "SCORPIO_CALLBACK_URL" && "$val" == *"api.sportsdey.com"* && "$val" != *"staging-api"* ]]; then
          val="https://staging-api.sportsdey.com/scorpio/callback"
          echo "  note: using staging callback URL for SCORPIO_CALLBACK_URL"
        fi
        upload_secret "$key" "$val"
        ;;
    esac
  done < "$DEV_VARS"
  set +a
else
  echo "WARN: $DEV_VARS missing — ensure SCORPIO_* secrets already exist on staging Worker."
fi

echo "==> Deploying server (staging)..."
(cd "$SERVER" && pnpm run deploy:staging)

echo "==> Deploying web (staging)..."
(cd "$WEB" && pnpm run deploy:staging)

echo "==> Smoke checks..."
UA='Mozilla/5.0'
for url in \
  'https://staging-api.sportsdey.com/scorpio/providers' \
  'https://staging-api.sportsdey.com/games?limit=1'
do
  code=$(curl -sS -o /tmp/stg-smoke.txt -w '%{http_code}' -A "$UA" "$url" --max-time 30 || echo err)
  echo "  $code  $url"
done

echo "Done. Open https://stagingweb.sportsdey.com/games"
