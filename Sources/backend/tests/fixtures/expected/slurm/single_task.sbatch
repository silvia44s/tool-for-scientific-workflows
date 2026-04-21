#!/bin/bash
#SBATCH -p qcpu
#SBATCH -A OPEN-30-42
#SBATCH -N 1
#SBATCH -t 0:10:0
#SBATCH -J Bash_Echo
#SBATCH -e /app/logs/node_1.err
#SBATCH -o /app/logs/node_1.log
#SBATCH --cpus-per-task=1
#SBATCH --mem=512M

set -euo pipefail

cd "$SLURM_SUBMIT_DIR"

mkdir -p "/app/results/work/bash_echo"
cd "/app/results/work/bash_echo"
export TEST_ENV=ok

# load modules
ml purge
ml GCC/9.3.0

# user prologue
export OMP_PROC_BIND=true
export OMP_PLACES=cores

/bin/bash -lc 'echo Hello from workflow editor'

# user epilogue
echo "Task finished."