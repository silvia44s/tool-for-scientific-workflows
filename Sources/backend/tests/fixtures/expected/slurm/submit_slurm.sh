#!/bin/bash
set -euo pipefail

declare -A JOB_IDS

JOB_IDS[node_1]=$(sbatch jobs/node_1.sbatch | awk '{print $4}')

echo "Slurm workflow submitted successfully."
