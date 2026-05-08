#!/usr/bin/env bash
set -euo pipefail

# workflow: demo_branched_abcd

echo 'Running: A - Generate numbers'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/work/node_a_generate_numbers
  cd /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/work/node_a_generate_numbers
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/out
  python3 /home/silvia/workflow_editor/workflow-editor/Demo/linear_workflow/tools/gen_numbers.py --start 1 --end 5 --out /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/out/numbers.txt
)

echo 'Running: B - Multiply numbers'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/work/node_b_multiply_numbers
  cd /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/work/node_b_multiply_numbers
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/out
  python3 /home/silvia/workflow_editor/workflow-editor/Demo/linear_workflow/tools/multiply_numbers.py --input /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/out/numbers.txt --factor 10 --out /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/out/multiplied.txt
)

echo 'Running: C - Add external offsets'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/work/node_c_add_external_offsets
  cd /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/work/node_c_add_external_offsets
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/out
  python3 /home/silvia/workflow_editor/workflow-editor/Demo/branched_workflow/tools/node_c_add_external_offsets.py --input /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/out/numbers.txt --offsets /home/silvia/workflow_editor/workflow-editor/Demo/branched_workflow/input/offsets.txt --out /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/out/offset_added.txt
)

echo 'Running: D - Merge B and C'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/work/node_d_merge_results
  cd /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/work/node_d_merge_results
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/out
  python3 /home/silvia/workflow_editor/workflow-editor/Demo/branched_workflow/tools/node_d_merge_results.py --left /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/out/multiplied.txt --right /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/out/offset_added.txt --operation sum --out /home/silvia/workflow_editor/workflow-editor/runs/demo_branched_abcd_20260507_132700/results/out/final_result.txt
)
