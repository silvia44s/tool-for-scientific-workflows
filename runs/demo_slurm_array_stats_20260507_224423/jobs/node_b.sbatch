#!/bin/bash
#SBATCH -p short
#SBATCH -A demo
#SBATCH -N 1
#SBATCH -t 0:15:0
#SBATCH -J B_-_Merge_SLURM_chunk_statistics
#SBATCH -e /home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224423/results/logs/node_b.err
#SBATCH -o /home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224423/results/logs/node_b.log
#SBATCH --cpus-per-task=1
#SBATCH --mem=1024M
#SBATCH --job-name=wf_slurm_merge

set -euo pipefail

cd "$SLURM_SUBMIT_DIR"

mkdir -p "/home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224423/results/work/slurm_merge_stats"
cd "/home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224423/results/work/slurm_merge_stats"
mkdir -p "/home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224423/results/out"

# load modules
ml purge
ml python/3.11

python3 /home/silvia/workflow_editor/workflow-editor/Demo/slurm_workflow/tools/slurm_merge_stats.py --chunks /home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224423/results/out/chunks --out /home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224423/results/out/slurm_summary.txt
