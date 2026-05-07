#!/usr/bin/env bash
set -euo pipefail

INPUT=""
OUTDIR=""
CHUNKS="3"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input) INPUT="$2"; shift 2 ;;
    --outdir) OUTDIR="$2"; shift 2 ;;
    --chunks) CHUNKS="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

TASK_ID="${SLURM_ARRAY_TASK_ID:-1}"
mkdir -p "$OUTDIR"
OUT="$OUTDIR/chunk_${TASK_ID}.tsv"

# Keep header and select records belonging to this array index.
awk -v id="$TASK_ID" -v chunks="$CHUNKS" 'BEGIN{FS=OFS="\t"} NR==1{print; next} ((NR-2) % chunks) + 1 == id {print}' "$INPUT" > "$OUT"

echo "[slurm_prepare_chunk] task=${TASK_ID} wrote $OUT"
