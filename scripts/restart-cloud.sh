#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export POCKET_FORCE_RESTART=1
exec bash scripts/start-cloud.sh
