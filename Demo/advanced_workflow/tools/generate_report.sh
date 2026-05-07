#!/usr/bin/env bash
set -euo pipefail

summary=""
out=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --summary) summary="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$summary" || -z "$out" ]]; then
  echo "Usage: generate_report.sh --summary FILE --out FILE" >&2
  exit 2
fi

mkdir -p "$(dirname "$out")"
{
  echo "Advanced workflow report"
  echo "========================"
  echo ""
  while IFS='=' read -r key value; do
    [[ -z "$key" ]] && continue
    printf '%s: %s\n' "$key" "$value"
  done < "$summary"
} > "$out"

echo "[generate_report] wrote report to $out"
