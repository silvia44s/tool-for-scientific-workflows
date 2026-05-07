#!/bin/bash
set -euo pipefail

declare -A JOB_IDS

JOB_IDS[node_a]=$(qsub jobs/node_a.pbs)
JOB_IDS[node_b]=$(qsub -W depend=afterok:${JOB_IDS[node_a]} jobs/node_b.pbs)

echo "PBS workflow submitted successfully."
