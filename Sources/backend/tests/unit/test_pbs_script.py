from __future__ import annotations

from pathlib import Path

from workflow_backend.generate.planner import topological_order
from workflow_backend.generate.execution_planner import build_execution_plan
from workflow_backend.generate.pbs_script import (
    render_pbs_job,
    generate_pbs_scripts,
)


def test_render_pbs_job_contains_basic_directives(pbs_single_task_wf):
    order = topological_order(pbs_single_task_wf)
    plan = build_execution_plan(pbs_single_task_wf, order)

    text = render_pbs_job(plan.steps[0], "/tmp/logs")

    assert text.startswith("#!/bin/bash")
    assert "#PBS -N Bash_Echo" in text
    assert "#PBS -o /tmp/logs/node_1.log" in text
    assert "#PBS -e /tmp/logs/node_1.err" in text


def test_render_pbs_job_contains_resource_directives(pbs_single_task_wf):
    order = topological_order(pbs_single_task_wf)
    plan = build_execution_plan(pbs_single_task_wf, order)

    text = render_pbs_job(plan.steps[0], "/tmp/logs")

    assert "#PBS -l select=1:ncpus=1:mem=512mb" in text
    assert "#PBS -l walltime=00:10:00" in text
    assert "#PBS -q default" in text
    assert "#PBS -A my_project" in text


def test_render_pbs_job_contains_workdir_and_command(pbs_single_task_wf):
    order = topological_order(pbs_single_task_wf)
    plan = build_execution_plan(pbs_single_task_wf, order)

    text = render_pbs_job(plan.steps[0], "/tmp/logs")

    assert 'cd "${PBS_O_WORKDIR}"' in text
    assert 'mkdir -p "runs/test_pbs_single_task_bash/results/work/bash_echo"' in text
    assert '/bin/bash -lc' in text
    assert "echo Hello from workflow editor" in text


def test_render_pbs_job_contains_prologue_and_epilogue(pbs_single_task_wf):
    order = topological_order(pbs_single_task_wf)
    plan = build_execution_plan(pbs_single_task_wf, order)

    text = render_pbs_job(plan.steps[0], "/tmp/logs")

    assert '# user prologue' in text
    assert 'echo "Starting PBS task"' in text
    assert '# user epilogue' in text
    assert 'echo "Finished PBS task"' in text


def test_generate_pbs_scripts_creates_files(pbs_single_task_wf, tmp_path):
    order = topological_order(pbs_single_task_wf)
    plan = build_execution_plan(pbs_single_task_wf, order)

    submit_path = generate_pbs_scripts(plan, str(tmp_path))

    assert Path(submit_path).exists()
    assert (tmp_path / "jobs" / "node_1.pbs").exists()


def test_generate_pbs_submit_script_contains_qsub(pbs_single_task_wf, tmp_path):
    order = topological_order(pbs_single_task_wf)
    plan = build_execution_plan(pbs_single_task_wf, order)

    submit_path = Path(generate_pbs_scripts(plan, str(tmp_path)))
    text = submit_path.read_text(encoding="utf-8")

    assert text.startswith("#!/bin/bash")
    assert "set -euo pipefail" in text
    assert "declare -A JOB_IDS" in text
    assert "JOB_IDS[node_1]=$(qsub jobs/node_1.pbs)" in text
    assert 'echo "PBS workflow submitted successfully."' in text