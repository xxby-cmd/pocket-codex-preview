#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -n "${CODESPACE_NAME:-}" ]] || exit 0
version=2.100.0
cli=".local/tools/gh_${version}_linux_amd64/bin/gh"
if [[ ! -x "$cli" ]]; then
  mkdir -p .local/tools
  archive=".local/tools/gh.tar.gz"
  curl --fail --location --retry 2 --max-time 90 "https://github.com/cli/cli/releases/download/v${version}/gh_${version}_linux_amd64.tar.gz" -o "$archive"
  tar -xzf "$archive" -C .local/tools
fi
for attempt in $(seq 1 8); do
  if "$cli" codespace ports visibility 8787:public -c "$CODESPACE_NAME"; then
    echo '8787 已自动设为 Public，访问仍由随行密钥保护。'
    exit 0
  fi
  sleep 3
done
echo '端口自动公开失败，请在 Ports 将 8787 设为 Public。' >&2
exit 1
