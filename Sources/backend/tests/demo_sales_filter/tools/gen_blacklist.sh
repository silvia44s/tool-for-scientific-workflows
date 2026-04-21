#!/usr/bin/env bash
set -euo pipefail

CATEGORIES=""
OUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --categories)
      CATEGORIES="$2"
      shift 2
      ;;
    --out)
      OUT="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${CATEGORIES}" ]]; then
  echo "--categories is required" >&2
  exit 1
fi

if [[ -z "${OUT}" ]]; then
  echo "--out is required" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

IFS=',' read -r -a ITEMS <<< "$CATEGORIES"
: > "$OUT"

for item in "${ITEMS[@]}"; do
  trimmed="$(echo "$item" | xargs)"
  [[ -n "$trimmed" ]] && echo "$trimmed" >> "$OUT"
done

echo "[gen_blacklist] wrote blacklist to $OUT"