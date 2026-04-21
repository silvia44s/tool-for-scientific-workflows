#!/usr/bin/env bash
set -euo pipefail

# workflow: demo_numbers

echo 'Running: Generate numbers'
(
  mkdir -p /app/results/work/gen_numbers
  cd /app/results/work/gen_numbers
  mkdir -p /app/results/out
  python3 /home/silvia/workflow_editor/workflow-editor/Sources/backend/tests/demo_numbers/tools/gen_numbers.py --start 1 --end 5 --out /app/results/out/numbers.txt
)

echo 'Running: Multiply numbers'
(
  mkdir -p /app/results/work/multiply
  cd /app/results/work/multiply
  mkdir -p /app/results/out
  python3 /home/silvia/workflow_editor/workflow-editor/Sources/backend/tests/demo_numbers/tools/multiply_numbers.py --input /app/results/out/numbers.txt --factor 10 --out /app/results/out/multiplied.txt
)

echo 'Running: Summarize numbers'
(
  mkdir -p /app/results/work/summarize
  cd /app/results/work/summarize
  mkdir -p /app/results/out
  python3 /home/silvia/workflow_editor/workflow-editor/Sources/backend/tests/demo_numbers/tools/summarize_numbers.py --input /app/results/out/multiplied.txt --report /app/results/out/report.json
)