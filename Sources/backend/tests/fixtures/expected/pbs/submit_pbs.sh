#!/bin/bash
set -euo pipefail

declare -A JOB_IDS

JOB_IDS[node_1]=$(qsub jobs/node_1.pbs)

echo "PBS workflow submitted successfully."
