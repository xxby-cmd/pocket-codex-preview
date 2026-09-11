#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -z "${POCKET_BROWSER_TOKEN:-}" || -z "${POCKET_HOST_TOKEN:-}" ]]; then
  echo '请在 Codespaces Secrets 中分别设置 POCKET_BROWSER_TOKEN 和 POCKET_HOST_TOKEN，然后重新启动。'
  exit 1
fi
mkdir -p .local
BIND=0.0.0.0 nohup node relay.mjs > .local/relay.log 2>&1 &
echo '中转已启动；在 Ports 面板打开 8787。电脑连接程序需要访问这个端口，公开端口时仍由两种密钥分别保护。'
