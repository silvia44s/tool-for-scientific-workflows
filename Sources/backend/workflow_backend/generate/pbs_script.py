"""
PBS script generator.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List
import shlex

from workflow_backend.generate.execution_planner import ExecutionPlan, ExecutionStep


def _q(value: str) -> str:
    return shlex.quote(value)


def _sanitize(value: str) -> str:
    s = value.strip().replace(" ", "_")
    s = "".join(ch for ch in s if ch.isalnum() or ch in ("_", "-", "."))
    return s or "job"


def _minutes_to_hms(total_minutes: int | None) -> str | None:
    if total_minutes is None:
        return None
    hours = total_minutes // 60
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}:00"


def _collect_output_dirs(step: ExecutionStep) -> List[str]:
    dirs = set()
    for out_value in step.outputs.values():
        if not out_value or "://" in out_value:
            continue
        p = Path(out_value)
        parent = p if out_value.endswith("/") else p.parent
        if str(parent).strip() not in ("", "."):
            dirs.add(str(parent))
    return sorted(dirs)


def render_pbs_job(step: ExecutionStep, logs_dir: str) -> str:
    b = step.batch
    lines: List[str] = []

    lines.append("#!/bin/bash")
    lines.append(f"#PBS -N {_sanitize(step.name)}")
    lines.append(f"#PBS -o {logs_dir}/{_sanitize(step.node_id)}.log")
    lines.append(f"#PBS -e {logs_dir}/{_sanitize(step.node_id)}.err")

    resource_parts = []
    if b.cpus is not None:
        resource_parts.append(f"ncpus={b.cpus}")
    if b.memMB is not None:
        resource_parts.append(f"mem={b.memMB}mb")
    if resource_parts:
        lines.append("#PBS -l select=1:" + ":".join(resource_parts))

    if b.timeMin is not None:
        walltime = _minutes_to_hms(b.timeMin)
        if walltime:
            lines.append(f"#PBS -l walltime={walltime}")

    if b.partitionOrQueue:
        lines.append(f"#PBS -q {b.partitionOrQueue}")

    if b.account:
        lines.append(f"#PBS -A {b.account}")

    if b.array and b.array.enabled and b.array.start is not None and b.array.end is not None:
        if b.array.step is not None:
            lines.append(f"#PBS -J {b.array.start}-{b.array.end}:{b.array.step}")
        else:
            lines.append(f"#PBS -J {b.array.start}-{b.array.end}")

    custom_directives = (getattr(b, "customDirectives", "") or "").strip()
    if not custom_directives:
        custom_directives = (getattr(b, "custom", "") or "").strip()

    if custom_directives:
        for raw in custom_directives.splitlines():
            line = raw.strip()
            if not line:
                continue
            if line.startswith("#PBS"):
                lines.append(line)
            elif line.startswith("-"):
                lines.append(f"#PBS {line}")
            else:
                lines.append(f"#PBS {line}")

    lines.append("")
    lines.append("set -euo pipefail")
    lines.append('cd "${PBS_O_WORKDIR}"')
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
    return "\n".join(lines)


def generate_pbs_scripts(plan: ExecutionPlan, outdir: str) -> str:
    root = Path(outdir)
    jobs_dir = root / "jobs"
    logs_dir = root / "results" / "logs"

    jobs_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)

    job_files: Dict[str, Path] = {}

    for step in plan.steps:
        job_path = jobs_dir / f"{_sanitize(step.node_id)}.pbs"
        job_path.write_text(render_pbs_job(step, str(logs_dir)), encoding="utf-8")
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
                f"JOB_IDS[{_q(step.node_id)}]=$(qsub {_q(str(rel_job))})"
            )
        else:
            dep_expr = ":".join(f"${{JOB_IDS[{dep}]}}" for dep in step.dependencies)
            submit_lines.append(
                f"JOB_IDS[{_q(step.node_id)}]=$(qsub -W depend=afterok:{dep_expr} {_q(str(rel_job))})"
            )

    submit_lines.append("")
    submit_lines.append('echo "PBS workflow submitted successfully."')

    submit_path = root / "submit_pbs.sh"
    submit_path.write_text("\n".join(submit_lines) + "\n", encoding="utf-8")
    submit_path.chmod(0o755)

    return str(submit_path)