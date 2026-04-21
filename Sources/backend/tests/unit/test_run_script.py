from __future__ import annotations

import subprocess
from pathlib import Path

from workflow_backend.generate.planner import topological_order
from workflow_backend.generate.execution_planner import build_execution_plan
from workflow_backend.generate.run_script import generate_run_script


def test_run_script_file_is_created(demo_numbers_wf, tmp_path):
    order = topological_order(demo_numbers_wf)
    plan = build_execution_plan(demo_numbers_wf, order)

    out = tmp_path / "run.sh"
    generate_run_script(plan, str(out))

    assert out.exists()


def test_run_script_contains_basic_header(demo_numbers_wf, tmp_path):
    order = topological_order(demo_numbers_wf)
    plan = build_execution_plan(demo_numbers_wf, order)

    out = tmp_path / "run.sh"
    generate_run_script(plan, str(out))

    text = out.read_text(encoding="utf-8")
    assert text.startswith("#!/usr/bin/env bash")
    assert "set -euo pipefail" in text
    assert "# workflow: demo_numbers" in text


def test_run_script_contains_all_steps(demo_numbers_wf, tmp_path):
    order = topological_order(demo_numbers_wf)
    plan = build_execution_plan(demo_numbers_wf, order)

    out = tmp_path / "run.sh"
    generate_run_script(plan, str(out))

    text = out.read_text(encoding="utf-8")
    assert "Running: Generate numbers" in text
    assert "Running: Multiply numbers" in text
    assert "Running: Summarize numbers" in text


def test_run_script_contains_expected_commands(demo_numbers_wf, tmp_path):
    order = topological_order(demo_numbers_wf)
    plan = build_execution_plan(demo_numbers_wf, order)

    out = tmp_path / "run.sh"
    generate_run_script(plan, str(out))

    text = out.read_text(encoding="utf-8")
    assert "gen_numbers.py --start 1 --end 5 --out results/out/numbers.txt" in text
    assert "multiply_numbers.py --input results/out/numbers.txt --factor 10 --out results/out/multiplied.txt" in text
    assert "summarize_numbers.py --input results/out/multiplied.txt --report results/out/report.json" in text


def test_run_script_is_valid_bash_syntax(demo_numbers_wf, tmp_path):
    order = topological_order(demo_numbers_wf)
    plan = build_execution_plan(demo_numbers_wf, order)

    out = tmp_path / "run.sh"
    generate_run_script(plan, str(out))

    proc = subprocess.run(
        ["bash", "-n", str(out)],
        capture_output=True,
        text=True,
    )

    assert proc.returncode == 0, proc.stderr