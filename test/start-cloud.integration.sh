#!/usr/bin/env bash
set -euo pipefail
source_dir="$(cd "$(dirname "$0")/.." && pwd -P)"
fixture="$(mktemp -d /tmp/pocket-start-test.XXXXXX)"
cleanup() {
  if [[ -d "$fixture/client" ]]; then
    cd "$fixture/client"
    node scripts/relay-processes.mjs | xargs -r kill || true
  fi
  case "$fixture" in /tmp/pocket-start-test.*) rm -rf -- "$fixture";; esac
}
trap cleanup EXIT
# An isolated origin exercises a real pull without changing the live checkout.
git clone -q --bare "$source_dir" "$fixture/origin.git"
git clone -q "$fixture/origin.git" "$fixture/publisher"
cd "$fixture/publisher"
git config user.email test@example.invalid
git config user.name StartupTest
printf '#!/usr/bin/env bash\nexit 0\n' > scripts/public-port.sh
printf '#!/usr/bin/env bash\nexit 0\n' > scripts/watch-port.sh
git add .; git commit -qm 'Isolate port actions'; git push -q origin main
git clone -q "$fixture/origin.git" "$fixture/client"
cd "$fixture/client"
export PORT=18879 POCKET_BROWSER_TOKEN=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb POCKET_HOST_TOKEN=hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
# Start a legacy process at the correct path, then restore its on-disk source.
printf 'import http from "node:http";http.createServer((q,r)=>{r.writeHead(404);r.end("old");}).listen(Number(process.env.PORT),"127.0.0.1");\n' > relay.mjs
node relay.mjs > legacy.log 2>&1 &
old_pid=$!
sleep 1
git restore relay.mjs
cd "$fixture/publisher"
printf '\n<!-- startup-test -->\n' >> public/index.html
git add .; git commit -qm 'New runtime'; git push -q origin main
cd "$fixture/client"
bash scripts/start-cloud.sh
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]]
! kill -0 "$old_pid" 2>/dev/null
first_pid="$(cat .local/relay.pid)"
bash scripts/start-cloud.sh
[[ "$first_pid" == "$(cat .local/relay.pid)" ]]
printf '\nlocal edit\n' >> public/index.html
if bash scripts/start-cloud.sh; then echo 'FAIL: dirty checkout accepted'; exit 1; fi
kill -0 "$first_pid"
echo 'PASS: pulled new code, replaced legacy process, reused current process, preserved local edits.'
