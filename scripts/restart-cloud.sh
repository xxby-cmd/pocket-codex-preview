#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
project_dir="$(pwd -P)"
while read -r relay_pid; do
  [[ -n "$relay_pid" ]] || continue
  if [[ "$(readlink -f "/proc/$relay_pid/cwd" || true)" == "$project_dir" ]]; then
    kill "$relay_pid"
  fi
done < <(pgrep -f '^node relay.mjs$' || true)
sleep 1
bash scripts/start-cloud.sh
