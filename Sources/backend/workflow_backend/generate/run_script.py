"""
@file run_script.py
@author Silvia Šlachtovská
@brief Generates a local bash run script from an execution plan.

This module converts workflow execution steps into a single runnable shell
script used for local backend execution. Each step is emitted as an isolated
subshell block with its own working directory, environment and command.
"""

from pathlib import Path
from typing import List, Set
import shlex

from workflow_backend.generate.execution_planner import ExecutionPlan


def _q(value: str) -> str:
    """
    @brief Quotes a value for safe shell usage.

    @param value Raw shell argument.
    @return Shell-escaped value.
    """
    return shlex.quote(value)


def generate_run_script(plan: ExecutionPlan, outfile: str) -> None:
    """
    @brief Generates a local bash script for workflow execution.

    Converts each execution step into an isolated subshell block that prepares
    its working directory, creates output directories, exports environment
    variables, loads modules and runs the final command.

    @param plan Execution plan to convert.
    @param outfile Target path of the generated shell script.
    @return None
    """
    lines: List[str] = []

    lines.append("#!/usr/bin/env bash")
    lines.append("set -euo pipefail")
    lines.append("")
    lines.append(f"# workflow: {plan.workflow_name}")
    lines.append("")

    for step in plan.steps:

        # simple log so user sees progress
        lines.append(f"echo {_q(f'Running: {step.name}')}")
        lines.append("(")

        # change working directory if defined
        if step.workdir:
            lines.append(f"  mkdir -p {_q(step.workdir)}")
            lines.append(f"  cd {_q(step.workdir)}")

        # ensure directories for outputs exist
        for out_value in step.outputs.values():
            if not out_value or "://" in out_value:
                continue

            p = Path(out_value)
            parent = p if out_value.endswith("/") else p.parent
            if str(parent).strip() not in ("", "."):
                lines.append(f"  mkdir -p {_q(str(parent))}")

        # export environment variables
        for k, v in step.env.items():
            lines.append(f"  export {k}={_q(v)}")

        # library paths -> appended to LD_LIBRARY_PATH
        if step.library_paths:
            quoted_parts = ":".join(_q(p) for p in step.library_paths)
            lines.append(f"  export LD_LIBRARY_PATH={quoted_parts}:${{LD_LIBRARY_PATH:-}}")

        # HPC module loads
        for m in step.modules:
            lines.append(f"  module load {_q(m)}")

        # final command execution
        cmd = " ".join(_q(arg) for arg in step.argv)
        lines.append(f"  {cmd}")

        lines.append(")")
        lines.append("")

    Path(outfile).write_text("\n".join(lines), encoding="utf-8")