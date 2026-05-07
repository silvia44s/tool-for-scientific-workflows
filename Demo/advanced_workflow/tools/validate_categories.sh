#!/usr/bin/env bash
set -euo pipefail

categories=""
config=""
out=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --categories) categories="$2"; shift 2 ;;
    --config) config="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$categories" || -z "$config" || -z "$out" ]]; then
  echo "Usage: validate_categories.sh --categories FILE --config FILE --out FILE" >&2
  exit 2
fi

mkdir -p "$(dirname "$out")"
record_count=$(awk -F',' 'NR > 1 { sum += $2 } END { print sum + 0 }' "$categories")
min_records=$(grep '^min_records=' "$config" | cut -d '=' -f 2)

{
  echo "record_count=$record_count"
  echo "min_records=$min_records"
  if [[ "$record_count" -ge "$min_records" ]]; then
    echo "status=ok"
  else
    echo "status=failed"
  fi
} > "$out"

echo "[validate_categories] wrote validation to $out"
