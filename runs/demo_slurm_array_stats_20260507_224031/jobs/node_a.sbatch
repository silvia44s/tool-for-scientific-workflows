#!/bin/bash
#SBATCH -p short
#SBATCH -A demo
#SBATCH -N 1
#SBATCH -t 0:10:0
#SBATCH -J A_-_Split_samples_as_SLURM_array
#SBATCH -e /home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224031/results/logs/node_a.err
#SBATCH -o /home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224031/results/logs/node_a.log
#SBATCH --cpus-per-task=1
#SBATCH --mem=512M
#SBATCH --qos=normal
#SBATCH --array=1-3:1
#SBATCH --job-name=wf_slurm_split

set -euo pipefail

cd "$SLURM_SUBMIT_DIR"

mkdir -p "/home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224031/results/work/slurm_prepare_chunk"
cd "/home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224031/results/work/slurm_prepare_chunk"
mkdir -p "/home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224031/results/out"

# load modules
ml purge
ml python/3.11

/home/silvia/workflow_editor/workflow-editor/Demo/slurm_workflow/tools/slurm_prepare_chunk.sh --input /home/silvia/workflow_editor/workflow-editor/Demo/slurm_workflow/input/samples.tsv --outdir /home/silvia/workflow_editor/workflow-editor/runs/demo_slurm_array_stats_20260507_224031/results/out/chunks --chunks 3
