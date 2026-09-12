#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .local
exec 9>.local/start.lock
flock -w 120 9
# Parse this whole command before pulling, since the pull can update this file.
exec bash -c '
set -euo pipefail
if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "当前不是 main 分支，停止自动更新。" >&2; exit 1
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "云端有未提交的代码修改，停止自动更新；现有服务保持运行。" >&2; exit 1
fi
export GIT_TERMINAL_PROMPT=0
echo "正在同步最新代码……"
timeout 60 git fetch origin main
git merge --ff-only origin/main
exec bash scripts/run-cloud.sh
'
