#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -z "${POCKET_BROWSER_TOKEN:-}" || -z "${POCKET_HOST_TOKEN:-}" ]]; then
  echo '请在 Codespaces Secrets 中分别设置 POCKET_BROWSER_TOKEN 和 POCKET_HOST_TOKEN，然后重新启动。'
  exit 1
fi
mkdir -p .local
if [[ -f .local/relay.pid ]] && kill -0 "$(cat .local/relay.pid)" 2>/dev/null; then
  echo '已有连接程序进程，请先检查端口或使用 restart-cloud.sh 更新。'
  exit 0
fi
BIND=0.0.0.0 nohup node relay.mjs </dev/null > .local/relay.log 2>&1 &
relay_pid=$!
echo "$relay_pid" > .local/relay.pid
sleep 1
if ! kill -0 "$relay_pid" 2>/dev/null; then
  echo '中转启动失败，请查看 .local/relay.log。'
  exit 1
fi
echo '中转进程已启动；在 Ports 面板打开 8787。手机密钥设置保存在 .local/auth.json，请勿删除或上传此文件。'
