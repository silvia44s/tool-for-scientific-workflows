#!/usr/bin/env bash
set -euo pipefail

# workflow: demo_numbers

echo 'Running: Generate numbers'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/demo_numbers_20260507_125510/results/work/gen_numbers
  cd /home/silvia/workflow_editor/workflow-editor/runs/demo_numbers_20260507_125510/results/work/gen_numbers
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/demo_numbers_20260507_125510/results/out
  python3 /home/silvia/workflow_editor/workflow-editor/Demo/linear_workflow/tools/gen_numbers.py --start 1 --end 5 --out /home/silvia/workflow_editor/workflow-editor/runs/demo_numbers_20260507_125510/results/out/numbers.txt
)

echo 'Running: Multiply numbers'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/demo_numbers_20260507_125510/results/work/multiply
  cd /home/silvia/workflow_editor/workflow-editor/runs/demo_numbers_20260507_125510/results/work/multiply
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/demo_numbers_20260507_125510/results/out
  python3 /home/silvia/workflow_editor/workflow-editor/Demo/linear_workflow/tools/multiply_numbers.py --input /home/silvia/workflow_editor/workflow-editor/runs/demo_numbers_20260507_125510/results/out/numbers.txt --factor 10 --out /home/silvia/workflow_editor/workflow-editor/runs/demo_numbers_20260507_125510/results/out/multiplied.txt
)
