#!/bin/bash
set -euo pipefail

declare -A JOB_IDS

JOB_IDS[node_a]=$(sbatch jobs/node_a.sbatch | awk '{print $4}')
JOB_IDS[node_b]=$(sbatch --dependency=afterok:${JOB_IDS[node_a]} jobs/node_b.sbatch | awk '{print $4}')

echo "Slurm workflow submitted successfully."
