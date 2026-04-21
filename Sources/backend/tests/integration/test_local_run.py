from __future__ import annotations

from pathlib import Path
import json
import os
import subprocess

import pytest

from workflow_backend.models import WorkflowDoc
from workflow_backend.generate.planner import topological_order
from workflow_backend.generate.execution_planner import build_execution_plan
from workflow_backend.generate.run_script import generate_run_script


def _all_binaries_exist(wf: WorkflowDoc) -> bool:
    for node in wf.nodes.values():
        if node.type != "task":
            continue
        if not Path(node.task.config.binaryPath).exists():
            return False
    return True


@pytest.mark.integration
def test_demo_numbers_local_run_smoke(demo_numbers_wf, tmp_path):
    if not _all_binaries_exist(demo_numbers_wf):
        pytest.skip("Demo tool scripts are not available on this machine.")

    wf = demo_numbers_wf.model_copy(deep=True)
    wf.run.resultsRoot = str(tmp_path / "results")

    order = topological_order(wf)
    plan = build_execution_plan(wf, order)

    script_path = tmp_path / "run.sh"
    generate_run_script(plan, str(script_path))
    script_path.chmod(0o755)

    proc = subprocess.run(
        ["bash", str(script_path)],
        cwd=str(tmp_path),
        capture_output=True,
        text=True,
    )

    assert proc.returncode == 0, proc.stderr

    report_path = tmp_path / "results" / "out" / "report.json"
    assert report_path.exists()

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert isinstance(report, dict)