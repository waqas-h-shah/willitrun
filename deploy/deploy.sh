#!/bin/bash
# Ship to amperor-server: sync source, build the image there, restart the container.
# First deploy only: also installs the Caddy site and points DNS at the Cloudflare tunnel (pass --first).
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=amperor-server
APP=server/apps/willitrun
ssh "$HOST" "mkdir -p $APP/src"
rsync -az --delete --exclude node_modules --exclude .next --exclude data --exclude .git --exclude .claude --exclude "*.tsbuildinfo" ./ "$HOST:$APP/src/"
rsync -az deploy/docker-compose.yml "$HOST:$APP/docker-compose.yml"
ssh "$HOST" "cd $APP && docker compose build && docker compose up -d && docker image prune -f >/dev/null"
if [ "${1:-}" = "--first" ]; then
  rsync -az deploy/willitrun.caddy "$HOST:server/caddy/sites/willitrun.caddy"
  ssh "$HOST" "docker compose -f ~/server/docker-compose.yml exec -T caddy caddy reload --config /etc/caddy/Caddyfile && ~/server/scripts/cf-route.sh willitrun.amperor.ai"
fi
echo "deployed → https://willitrun.amperor.ai"
