"""
Shell script generator.

This module takes an ExecutionPlan and converts it into a runnable
bash script. Each workflow step becomes one bash block.

The idea is simple:
ExecutionPlan → bash script → executed by backend.

"""

from pathlib import Path
from typing import List, Set
import shlex

from workflow_backend.generate.execution_planner import ExecutionPlan


def _q(value: str) -> str:
    """
    Quote a value for safe usage in bash.
    Prevents problems with spaces or special characters.
    """
    return shlex.quote(value)


def _is_probably_path(value: str) -> bool:
    """
    Small heuristic to guess whether a value looks like a filesystem path.

    Not perfect but works well enough for most cases.

    Rules:
    - URLs are not paths
    - strings with '/' or starting with '.' probably are paths
    """
    if not value:
        return False
    if "://" in value:
        return False
    return "/" in value or value.startswith(".")


def _collect_output_parent_dirs(plan: ExecutionPlan) -> List[str]:
    """
    Collect all directories that should exist before running tasks.

    For each output value we create its parent directory.
    """
    dirs: Set[str] = set()

    for step in plan.steps:
        for value in step.outputs.values():
            if not value or "://" in value:
                continue

            p = Path(value)

            # if it looks like a directory we still create parent safely
            parent = p if value.endswith("/") else p.parent
            if str(parent).strip():
                dirs.add(str(parent))

    return sorted(dirs)


def generate_run_script(plan: ExecutionPlan, outfile: str) -> None:
    """
    Convert execution plan into a bash script.

    Structure of generated script roughly:

        step1:
            cd workdir
            export env
            module load ...
            command

        step2:
            ...

    Each step runs in its own subshell so environment changes
    do not leak to the next step.
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