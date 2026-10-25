#!/usr/bin/env bash
# Pushes the values in .env.secrets.local to a Convex deployment.
# Usage: scripts/push-secrets.sh dev|prod
set -euo pipefail

target="${1:-}"
if [[ "$target" != "dev" && "$target" != "prod" ]]; then
  echo "Usage: scripts/push-secrets.sh dev|prod" >&2
  exit 1
fi

file=".env.secrets.local"
if [[ ! -f "$file" ]]; then
  echo "Missing $file. Copy .env.secrets.example to $file and fill it in." >&2
  exit 1
fi

flag=()
if [[ "$target" == "prod" ]]; then
  flag=(--prod)
fi

# Generate the two shared secrets once, and write them back so dev, prod, and Apify all agree.
for name in APIFY_WEBHOOK_SECRET SPOTIFY_STATE_SECRET; do
  if grep -qE "^${name}=$" "$file"; then
    value="$(openssl rand -hex 32)"
    tmp="$(mktemp)"
    awk -v n="$name" -v v="$value" 'BEGIN { FS = OFS = "=" } $1 == n && $2 == "" { print n "=" v; next } { print }' "$file" > "$tmp"
    mv "$tmp" "$file"
    echo "generated $name"
  fi
done

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  name="${line%%=*}"
  value="${line#*=}"
  if [[ -z "$value" ]]; then
    echo "skip $name (empty)"
    continue
  fi
  npx convex env set ${flag[@]+"${flag[@]}"} "$name" "$value" > /dev/null
  echo "set $name on $target"
done < "$file"
