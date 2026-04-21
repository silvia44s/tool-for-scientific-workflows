from __future__ import annotations

from pathlib import Path

from workflow_backend.generate.planner import topological_order
from workflow_backend.generate.execution_planner import build_execution_plan
from workflow_backend.generate.slurm_script import (
    render_slurm_job,
    generate_slurm_scripts,
)


def test_render_slurm_job_contains_basic_directives(slurm_single_task_wf):
    order = topological_order(slurm_single_task_wf)
    plan = build_execution_plan(slurm_single_task_wf, order)

    text = render_slurm_job(plan.steps[0], "/tmp/logs")

    assert text.startswith("#!/bin/bash")
    assert "#SBATCH -p qcpu" in text
    assert "#SBATCH -A OPEN-30-42" in text
    assert "#SBATCH -N 1" in text
    assert "#SBATCH -J Bash_Echo" in text


def test_render_slurm_job_contains_resource_directives(slurm_single_task_wf):
    order = topological_order(slurm_single_task_wf)
    plan = build_execution_plan(slurm_single_task_wf, order)

    text = render_slurm_job(plan.steps[0], "/tmp/logs")

    assert "#SBATCH -t 0:10:0" in text
    assert "#SBATCH --cpus-per-task=1" in text
    assert "#SBATCH --mem=512M" in text
    assert "#SBATCH -e /tmp/logs/node_1.err" in text
    assert "#SBATCH -o /tmp/logs/node_1.log" in text


def test_render_slurm_job_contains_env_modules_and_body(slurm_single_task_wf):
    order = topological_order(slurm_single_task_wf)
    plan = build_execution_plan(slurm_single_task_wf, order)

    text = render_slurm_job(plan.steps[0], "/tmp/logs")

    assert 'cd "$SLURM_SUBMIT_DIR"' in text
    assert 'mkdir -p "runs/test_slurm_single_task_bash/results/work/bash_echo"' in text
    assert "export TEST_ENV=ok" in text
    assert "ml purge" in text
    assert "ml GCC/9.3.0" in text
    assert '/bin/bash -lc' in text


def test_render_slurm_job_contains_prologue_and_epilogue(slurm_single_task_wf):
    order = topological_order(slurm_single_task_wf)
    plan = build_execution_plan(slurm_single_task_wf, order)

    text = render_slurm_job(plan.steps[0], "/tmp/logs")

    assert "# user prologue" in text
    assert "export OMP_PROC_BIND=true" in text
    assert "export OMP_PLACES=cores" in text
    assert "# user epilogue" in text
    assert 'echo "Task finished."' in text


def test_generate_slurm_scripts_creates_files(slurm_single_task_wf, tmp_path):
    order = topological_order(slurm_single_task_wf)
    plan = build_execution_plan(slurm_single_task_wf, order)

    submit_path = generate_slurm_scripts(plan, str(tmp_path))

    assert Path(submit_path).exists()
    assert (tmp_path / "jobs" / "node_1.sbatch").exists()


def test_generate_slurm_submit_script_contains_sbatch(slurm_single_task_wf, tmp_path):
    order = topological_order(slurm_single_task_wf)
    plan = build_execution_plan(slurm_single_task_wf, order)

    submit_path = Path(generate_slurm_scripts(plan, str(tmp_path)))
    text = submit_path.read_text(encoding="utf-8")

    assert text.startswith("#!/bin/bash")
    assert "set -euo pipefail" in text
    assert "declare -A JOB_IDS" in text
    assert "JOB_IDS[node_1]=$(sbatch jobs/node_1.sbatch | awk '{print $4}')" in text
    assert 'echo "Slurm workflow submitted successfully."' in text