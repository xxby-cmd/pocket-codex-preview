#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
project_dir="$(pwd -P)"
if [[ -z "${POCKET_BROWSER_TOKEN:-}" || -z "${POCKET_HOST_TOKEN:-}" ]]; then
  echo '缺少 Codespaces Secrets，请检查 POCKET_BROWSER_TOKEN 和 POCKET_HOST_TOKEN。'
  exit 1
fi
mkdir -p .local
exec 9>.local/start.lock
flock -w 20 9
# The editor can restore its saved Private visibility after startup.
# A singleton watcher repairs only relay port 8787 while this cloud is running.
setsid nohup bash scripts/watch-port.sh </dev/null >>.local/port-watch.log 2>&1 9>&- &
healthy() {
  node --input-type=module -e "try{const r=await fetch('http://127.0.0.1:8787/usage',{signal:AbortSignal.timeout(1500)});const j=await r.json();process.exit(r.ok&&('remainingHours' in j)?0:1)}catch{process.exit(1)}"
}
if healthy; then
  bash scripts/public-port.sh
  echo '中转已运行，8787 健康检查通过。'
  exit 0
fi
# A stale PID may belong to an unrelated process after a container restart.
# Never treat PID existence alone as proof that the relay is alive.
if [[ -f .local/relay.pid ]]; then
  old_pid="$(cat .local/relay.pid)"
  if [[ "$old_pid" =~ ^[0-9]+$ ]] && [[ -r "/proc/$old_pid/cmdline" ]]; then
    command_line="$(tr '\0' ' ' < "/proc/$old_pid/cmdline")"
    if [[ "$(readlink -f "/proc/$old_pid/cwd" || true)" == "$project_dir" ]] && [[ "$command_line" == *"node "*"relay.mjs"* ]]; then
      kill "$old_pid" 2>/dev/null || true
      sleep 1
    fi
  fi
fi
# Detach from the lifecycle command's terminal and process group.
BIND=0.0.0.0 setsid nohup node "$project_dir/relay.mjs" </dev/null >>.local/relay.log 2>&1 9>&- &
relay_pid=$!
echo "$relay_pid" > .local/relay.pid
for attempt in $(seq 1 15); do
  if healthy; then
    bash scripts/public-port.sh
    echo '中转启动成功：8787 健康检查通过。'
    exit 0
  fi
  sleep 1
done
echo '中转未通过健康检查，请查看 .local/relay.log。'
exit 1
