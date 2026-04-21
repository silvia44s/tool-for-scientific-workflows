from pathlib import Path

from workflow_backend.generate.planner import topological_order
from workflow_backend.generate.execution_planner import build_execution_plan
from workflow_backend.generate.slurm_script import render_slurm_job, generate_slurm_scripts


def normalize(s: str) -> str:
    return "\n".join(line.rstrip() for line in s.strip().splitlines())


def test_slurm_script_matches_golden(slurm_single_task_wf):
    wf = slurm_single_task_wf.model_copy(deep=True)
    wf.run.resultsRoot = "/app/results"

    order = topological_order(wf)
    plan = build_execution_plan(wf, order)

    generated = normalize(render_slurm_job(plan.steps[0], "/app/logs"))

    expected_path = Path("tests/fixtures/expected/slurm/single_task.sbatch")
    expected = normalize(expected_path.read_text(encoding="utf-8"))

    assert generated == expected


def test_submit_slurm_script_matches_golden(slurm_single_task_wf, tmp_path):
    wf = slurm_single_task_wf.model_copy(deep=True)
    wf.run.resultsRoot = "/app/results"

    order = topological_order(wf)
    plan = build_execution_plan(wf, order)

    generate_slurm_scripts(plan, str(tmp_path))

    generated = normalize((tmp_path / "submit_slurm.sh").read_text(encoding="utf-8"))

    expected_path = Path("tests/fixtures/expected/slurm/submit_slurm.sh")
    expected = normalize(expected_path.read_text(encoding="utf-8"))

    assert generated == expected