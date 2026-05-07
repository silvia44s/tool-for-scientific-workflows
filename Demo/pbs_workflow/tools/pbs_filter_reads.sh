#!/usr/bin/env bash
set -euo pipefail

INPUT=""
OUTDIR=""
MIN_QUALITY="30"
PARTS="2"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input) INPUT="$2"; shift 2 ;;
    --outdir) OUTDIR="$2"; shift 2 ;;
    --min-quality) MIN_QUALITY="$2"; shift 2 ;;
    --parts) PARTS="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

TASK_ID="${PBS_ARRAYID:-${PBS_ARRAY_INDEX:-1}}"
mkdir -p "$OUTDIR"
OUT="$OUTDIR/filtered_${TASK_ID}.tsv"

awk -v id="$TASK_ID" -v parts="$PARTS" -v minq="$MIN_QUALITY" 'BEGIN{FS=OFS="\t"} NR==1{print; next} $3 >= minq && (((NR-2) % parts) + 1 == id) {print}' "$INPUT" > "$OUT"

echo "[pbs_filter_reads] task=${TASK_ID} wrote $OUT"
