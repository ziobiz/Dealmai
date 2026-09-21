#!/usr/bin/env bash
# Merge Invoice Service keys into /etc/dealmai/env (from JSON file arg or stdin).
set -euo pipefail
KEY_JSON="${1:-/tmp/dealmai-invoice-key.json}"
ENV_FILE=/etc/dealmai/env
if [[ ! -f "$KEY_JSON" ]]; then
  echo "missing $KEY_JSON"
  exit 1
fi
python3 - <<PY
import json, re
from pathlib import Path
key = json.loads(Path("$KEY_JSON").read_text())
env_path = Path("$ENV_FILE")
text = env_path.read_text() if env_path.exists() else ""
pairs = {
  "INVOICE_BASE_URL": key["INVOICE_BASE_URL"],
  "INVOICE_API_KEY": key["INVOICE_API_KEY"],
  "INVOICE_HMAC_SECRET": key["INVOICE_HMAC_SECRET"],
  "INVOICE_SITE_CODE": key.get("INVOICE_SITE_CODE") or "dealmai",
}
lines = text.splitlines()
out = []
seen = set()
for line in lines:
  m = re.match(r'^([A-Za-z0-9_]+)=', line)
  if m and m.group(1) in pairs:
    k = m.group(1)
    out.append(f'{k}={pairs[k]}')
    seen.add(k)
  else:
    out.append(line)
for k, v in pairs.items():
  if k not in seen:
    out.append(f'{k}={v}')
env_path.parent.mkdir(parents=True, exist_ok=True)
env_path.write_text("\n".join(out).rstrip() + "\n")
env_path.chmod(0o600)
print("UPDATED", env_path)
print("KEYS", ",".join(pairs.keys()))
PY
