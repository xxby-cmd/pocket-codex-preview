#!/usr/bin/env bash
# Called by start-cloud.sh with the startup lock (fd 9) held.
set -euo pipefail
cd "$(dirname "$0")/.."
project_dir="$(pwd -P)"
port="${PORT:-8787}"
if [[ -z "${POCKET_BROWSER_TOKEN:-}" || -z "${POCKET_HOST_TOKEN:-}" ]]; then
  echo '缺少 Codespaces Secrets，请检查手机和电脑连接密钥。' >&2; exit 1
fi
node --check relay.mjs
node --check auth.mjs
expected_version="$(node runtime-version.mjs)"
healthy() {
  EXPECTED_PORT="$port" EXPECTED_VERSION="$expected_version" node --input-type=module -e "try{const r=await fetch('http://127.0.0.1:'+process.env.EXPECTED_PORT+'/ready',{signal:AbortSignal.timeout(1500)});const j=await r.json();process.exit(r.ok&&j.ready===true&&j.version===process.env.EXPECTED_VERSION?0:1)}catch{process.exit(1)}"
}
if [[ "${POCKET_FORCE_RESTART:-0}" == 1 ]] || ! healthy; then
  echo '正在替换旧版本或未就绪的中转进程……'
  mapfile -t relay_pids < <(node scripts/relay-processes.mjs)
  for relay_pid in "${relay_pids[@]}"; do
    # Recheck ownership immediately before signalling; never trust a stale PID file.
    if node scripts/relay-processes.mjs | grep -qx "$relay_pid"; then kill "$relay_pid" 2>/dev/null || true; fi
  done
  for attempt in $(seq 1 10); do
    [[ -z "$(node scripts/relay-processes.mjs)" ]] && break
    sleep 1
  done
  if [[ -n "$(node scripts/relay-processes.mjs)" ]]; then
    echo '旧中转进程未退出，停止启动，避免重复运行。' >&2; exit 1
  fi
  BIND=0.0.0.0 setsid nohup node "$project_dir/relay.mjs" </dev/null >>.local/relay.log 2>&1 9>&- &
  echo "$!" > .local/relay.pid
  for attempt in $(seq 1 15); do
    healthy && break
    sleep 1
  done
fi
if ! healthy; then
  echo '当前版本未通过 /ready 检查，请查看 .local/relay.log；不会报告启动成功。' >&2; exit 1
fi
bash scripts/public-port.sh
setsid nohup bash scripts/watch-port.sh </dev/null >>.local/port-watch.log 2>&1 9>&- &
echo "中转已就绪，运行版本：${expected_version:0:12}"
