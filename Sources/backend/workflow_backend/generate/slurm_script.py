"""
@file slurm_script.py
@author Silvia Šlachtovská
@brief Generates Slurm job and submission scripts from an execution plan.

This module converts workflow execution steps into individual Slurm batch
scripts and creates a wrapper submission script that submits the jobs in
dependency order.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List
import shlex

from workflow_backend.generate.execution_planner import ExecutionPlan, ExecutionStep


def _q(value: str) -> str:
    """
    @brief Quotes a value for safe shell usage.

    @param value Raw shell argument.
    @return Shell-escaped value.
    """
    return shlex.quote(value)


def _sanitize(value: str) -> str:
    """
    @brief Converts a string into a filesystem-safe Slurm job name fragment.

    @param value Input string.
    @return Sanitized identifier suitable for filenames and job names.
    """
    s = value.strip().replace(" ", "_")
    s = "".join(ch for ch in s if ch.isalnum() or ch in ("_", "-", "."))
    return s or "job"

def _minutes_to_slurm_time(total_minutes: int | None) -> str | None:
    """
    @brief Converts minutes into Slurm time format.

    @param total_minutes Duration in minutes.
    @return Time string in H:M:S format or None if the input is None.
    """
    if total_minutes is None:
        return None
    hours = total_minutes // 60
    minutes = total_minutes % 60
    return f"{hours}:{minutes}:0"


def _collect_output_dirs(step: ExecutionStep) -> List[str]:
    """
    @brief Collects output directories that should exist before task execution.

    Derives parent directories from resolved task outputs and ignores URLs
    and empty values.

    @param step Execution step whose outputs should be inspected.
    @return Sorted list of unique output directories.
    """
    dirs = set()
    for out_value in step.outputs.values():
        if not out_value or "://" in out_value:
            continue
        p = Path(out_value)
        parent = p if out_value.endswith("/") else p.parent
        if str(parent).strip() not in ("", "."):
            dirs.add(str(parent))
    return sorted(dirs)


def _render_scheduler_directives(step: ExecutionStep, logs_dir: str) -> List[str]:
    """
    @brief Renders the Slurm scheduler header for one job script.

    Includes resource requests, logging paths, optional array settings and
    custom scheduler directives derived from the step batch configuration.

    @param step Execution step to render.
    @param logs_dir Directory used for stdout and stderr log files.
    @return List of Slurm header lines.
    """
    b = step.batch
    lines: List[str] = []

    lines.append("#!/bin/bash")

    if b.partitionOrQueue:
        lines.append(f"#SBATCH -p {b.partitionOrQueue}")

    if b.account:
        lines.append(f"#SBATCH -A {b.account}")

    lines.append("#SBATCH -N 1")

    if b.timeMin is not None:
        t = _minutes_to_slurm_time(b.timeMin)
        if t:
            lines.append(f"#SBATCH -t {t}")

    lines.append(f"#SBATCH -J {_sanitize(step.name)}")
    lines.append(f"#SBATCH -e {logs_dir}/{_sanitize(step.node_id)}.err")
    lines.append(f"#SBATCH -o {logs_dir}/{_sanitize(step.node_id)}.log")

    if b.cpus is not None:
        lines.append(f"#SBATCH --cpus-per-task={b.cpus}")

    if b.memMB is not None:
        lines.append(f"#SBATCH --mem={b.memMB}M")

    if b.qos:
        lines.append(f"#SBATCH --qos={b.qos}")

    if b.array and b.array.enabled and b.array.start is not None and b.array.end is not None:
        if b.array.step is not None:
            lines.append(f"#SBATCH --array={b.array.start}-{b.array.end}:{b.array.step}")
        else:
            lines.append(f"#SBATCH --array={b.array.start}-{b.array.end}")

    custom_directives = (getattr(b, "customDirectives", "") or "").strip()
    if not custom_directives:
        custom_directives = (getattr(b, "custom", "") or "").strip()

    if custom_directives:
        for raw in custom_directives.splitlines():
            line = raw.strip()
            if not line:
                continue
            if line.startswith("#SBATCH"):
                lines.append(line)
            elif line.startswith("-"):
                lines.append(f"#SBATCH {line}")
            else:
                lines.append(f"#SBATCH {line}")

    lines.append("")
    return lines


def _render_shell_body(step: ExecutionStep) -> List[str]:
    """
    @brief Renders the executable shell body for one Slurm job.

    Prepares the working directory, creates output directories, exports
    environment variables, loads modules, applies optional prologue and
    epilogue code and appends the final command.

    @param step Execution step to render.
    @return List of shell body lines.
    """
    b = step.batch
    lines: List[str] = []

    lines.append("set -euo pipefail")
    lines.append("")
    lines.append('cd "$SLURM_SUBMIT_DIR"')
    lines.append("")

    if step.workdir:
        lines.append(f'mkdir -p "{step.workdir}"')
        lines.append(f'cd "{step.workdir}"')

    for out_dir in _collect_output_dirs(step):
        lines.append(f'mkdir -p "{out_dir}"')

    for k, v in step.env.items():
        lines.append(f"export {k}={_q(v)}")

    if step.modules:
        lines.append("")
        lines.append("# load modules")
        lines.append("ml purge")
        for m in step.modules:
            lines.append(f"ml {_q(m)}")

    if step.library_paths:
        joined = ":".join(step.library_paths)
        lines.append("")
        lines.append("# set library paths")
        lines.append(f'export LD_LIBRARY_PATH="{joined}:${{LD_LIBRARY_PATH:-}}"')

    prologue = (getattr(b, "prologue", "") or "").rstrip()
    if prologue:
        lines.append("")
        lines.append("# user prologue")
        lines.extend(prologue.splitlines())

    lines.append("")
    cmd = " ".join(_q(arg) for arg in step.argv)
    lines.append(cmd)

    epilogue = (getattr(b, "epilogue", "") or "").rstrip()
    if epilogue:
        lines.append("")
        lines.append("# user epilogue")
        lines.extend(epilogue.splitlines())

    lines.append("")
    return lines


def render_slurm_job(step: ExecutionStep, logs_dir: str) -> str:
    """
    @brief Renders one complete Slurm job script.

    Combines scheduler directives and shell body into a single script text.

    @param step Execution step to convert into a Slurm job.
    @param logs_dir Directory used for stdout and stderr log files.
    @return Full Slurm job script content.
    """
    lines: List[str] = []
    lines.extend(_render_scheduler_directives(step, logs_dir))
    lines.extend(_render_shell_body(step))
    return "\n".join(lines)


def generate_slurm_scripts(plan: ExecutionPlan, outdir: str) -> str:
    """
    @brief Generates Slurm job scripts and a wrapper submit script.

    Creates one .sbatch file per execution step and a submit_slurm.sh script
    that submits jobs in dependency order using afterok relationships.

    @param plan Execution plan to convert.
    @param outdir Target workflow run directory.
    @return Path to the generated submit script.
    """
    root = Path(outdir)
    jobs_dir = root / "jobs"
    logs_dir = root / "results" / "logs"

    jobs_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)

    job_files: Dict[str, Path] = {}

    for step in plan.steps:
        job_path = jobs_dir / f"{_sanitize(step.node_id)}.sbatch"
        job_path.write_text(render_slurm_job(step, str(logs_dir)), encoding="utf-8")
        job_path.chmod(0o755)
        job_files[step.node_id] = job_path

    submit_lines: List[str] = []
    submit_lines.append("#!/bin/bash")
    submit_lines.append("set -euo pipefail")
    submit_lines.append("")
    submit_lines.append("declare -A JOB_IDS")
    submit_lines.append("")

    for step in plan.steps:
        rel_job = job_files[step.node_id].relative_to(root)

        if not step.dependencies:
            submit_lines.append(
                f"JOB_IDS[{_q(step.node_id)}]=$(sbatch {_q(str(rel_job))} | awk '{{print $4}}')"
            )
        else:
            dep_expr = ":".join(f"${{JOB_IDS[{dep}]}}" for dep in step.dependencies)
            submit_lines.append(
                f"JOB_IDS[{_q(step.node_id)}]=$(sbatch --dependency=afterok:{dep_expr} {_q(str(rel_job))} | awk '{{print $4}}')"
            )

    submit_lines.append("")
    submit_lines.append('echo "Slurm workflow submitted successfully."')

    submit_path = root / "submit_slurm.sh"
    submit_path.write_text("\n".join(submit_lines) + "\n", encoding="utf-8")
    submit_path.chmod(0o755)

    return str(submit_path)