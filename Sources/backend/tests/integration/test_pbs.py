from pathlib import Path

from workflow_backend.generate.planner import topological_order
from workflow_backend.generate.execution_planner import build_execution_plan
from workflow_backend.generate.pbs_script import render_pbs_job, generate_pbs_scripts


def normalize(s: str) -> str:
    return "\n".join(line.rstrip() for line in s.strip().splitlines())


def test_pbs_script_matches_golden(pbs_single_task_wf):
    wf = pbs_single_task_wf.model_copy(deep=True)
    wf.run.resultsRoot = "/app/results"

    order = topological_order(wf)
    plan = build_execution_plan(wf, order)

    generated = normalize(render_pbs_job(plan.steps[0], "/app/logs"))

    expected_path = Path("tests/fixtures/expected/pbs/single_task.pbs")
    expected = normalize(expected_path.read_text(encoding="utf-8"))

    assert generated == expected


def test_submit_pbs_script_matches_golden(pbs_single_task_wf, tmp_path):
    wf = pbs_single_task_wf.model_copy(deep=True)
    wf.run.resultsRoot = "/app/results"

    order = topological_order(wf)
    plan = build_execution_plan(wf, order)

    generate_pbs_scripts(plan, str(tmp_path))

    generated = normalize((tmp_path / "submit_pbs.sh").read_text(encoding="utf-8"))

    expected_path = Path("tests/fixtures/expected/pbs/submit_pbs.sh")
    expected = normalize(expected_path.read_text(encoding="utf-8"))

    assert generated == expected