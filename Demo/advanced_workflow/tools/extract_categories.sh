#!/usr/bin/env bash
set -euo pipefail

input=""
out=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input) input="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$input" || -z "$out" ]]; then
  echo "Usage: extract_categories.sh --input FILE --out FILE" >&2
  exit 2
fi

mkdir -p "$(dirname "$out")"
awk -F',' '
  BEGIN { OFS="," }
  NR == 1 { next }
  { count[$3]++ }
  END {
    print "category,count"
    for (category in count) {
      print category,count[category]
    }
  }
' "$input" > "$out"

echo "[extract_categories] wrote categories to $out"
