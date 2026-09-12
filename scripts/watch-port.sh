#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."
[[ -n "${CODESPACE_NAME:-}" ]] || exit 0
mkdir -p .local
exec 8>.local/port-watch.lock
flock -n 8 || exit 0
cli=".local/tools/gh_2.100.0_linux_amd64/bin/gh"
while true; do
  visibility="$("$cli" codespace ports -c "$CODESPACE_NAME" --json sourcePort,visibility --jq '.[] | select(.sourcePort == 8787) | .visibility' 2>/dev/null)"
  if [[ "$visibility" != "public" ]]; then
    bash scripts/public-port.sh || true
  fi
  sleep 30
done
