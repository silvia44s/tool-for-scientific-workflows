from pathlib import Path

from workflow_backend.generate.execution_planner import build_execution_plan
from workflow_backend.generate.planner import topological_order
from workflow_backend.generate.run_script import generate_run_script


def normalize(s: str) -> str:
    return "\n".join(line.rstrip() for line in s.strip().splitlines())


def test_run_script_matches_golden(demo_numbers_wf, tmp_path):
    wf = demo_numbers_wf.model_copy(deep=True)
    wf.run.resultsRoot = "/app/results"

    order = topological_order(wf)
    plan = build_execution_plan(wf, order)

    out_path = tmp_path / "run.sh"
    generate_run_script(plan, str(out_path))

    generated = normalize(out_path.read_text(encoding="utf-8"))

    expected_path = Path("tests/fixtures/expected/run_scripts/demo_numbers.sh")
    expected = normalize(expected_path.read_text(encoding="utf-8"))

    assert generated == expected, f"\nGENERATED:\n{generated}\n\nEXPECTED:\n{expected}\n"