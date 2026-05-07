#!/usr/bin/env bash
set -euo pipefail

src=""
out=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --src) src="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$src" || -z "$out" ]]; then
  echo "Usage: prepare_input.sh --src FILE --out FILE" >&2
  exit 2
fi

mkdir -p "$(dirname "$out")"
cp "$src" "$out"

echo "[prepare_input] copied $src to $out"
