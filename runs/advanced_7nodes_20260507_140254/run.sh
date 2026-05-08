#!/usr/bin/env bash
set -euo pipefail

# workflow: advanced_7nodes

echo 'Running: A - Prepare input data'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/prepare_input
  cd /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/prepare_input
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out
  /home/silvia/workflow_editor/workflow-editor/Demo/advanced_workflow/tools/prepare_input.sh --src /home/silvia/workflow_editor/workflow-editor/Demo/advanced_workflow/input/products.csv --out /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/products_raw.csv
)

echo 'Running: B - Normalize products'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/normalize_products
  cd /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/normalize_products
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out
  python3 /home/silvia/workflow_editor/workflow-editor/Demo/advanced_workflow/tools/normalize_products.py --input /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/products_raw.csv --out /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/products_normalized.csv
)

echo 'Running: C - Extract categories'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/extract_categories
  cd /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/extract_categories
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out
  /home/silvia/workflow_editor/workflow-editor/Demo/advanced_workflow/tools/extract_categories.sh --input /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/products_raw.csv --out /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/categories.csv
)

echo 'Running: D - Compute sales statistics'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/compute_sales
  cd /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/compute_sales
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out
  python3 /home/silvia/workflow_editor/workflow-editor/Demo/advanced_workflow/tools/compute_sales.py --input /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/products_normalized.csv --out /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/sales_stats.txt
)

echo 'Running: E - Validate categories'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/validate_categories
  cd /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/validate_categories
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out
  /home/silvia/workflow_editor/workflow-editor/Demo/advanced_workflow/tools/validate_categories.sh --categories /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/categories.csv --config /home/silvia/workflow_editor/workflow-editor/Demo/advanced_workflow/input/config.txt --out /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/validation.txt
)

echo 'Running: F - Merge summary'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/merge_summary
  cd /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/merge_summary
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out
  python3 /home/silvia/workflow_editor/workflow-editor/Demo/advanced_workflow/tools/merge_summary.py --stats /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/sales_stats.txt --validation /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/validation.txt --out /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/summary.txt
)

echo 'Running: G - Generate report'
(
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/generate_report
  cd /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/work/generate_report
  mkdir -p /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out
  /home/silvia/workflow_editor/workflow-editor/Demo/advanced_workflow/tools/generate_report.sh --summary /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/summary.txt --out /home/silvia/workflow_editor/workflow-editor/runs/advanced_7nodes_20260507_140254/results/out/final_report.txt
)
