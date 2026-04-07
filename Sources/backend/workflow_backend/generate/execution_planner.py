"""
Execution planner.

This module converts a validated workflow + ordered tasks
into a concrete execution plan.

Basically it resolves:
- final parameter values
- outputs of tasks
- data propagation along edges
- final argv for execution

The result is a list of steps that can later be turned into a shell script.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from workflow_backend.models import WorkflowDoc, TaskNode, WorkflowEdge, IOPort, TaskParam, BatchConfig


# -----------------------------
# Result structures
# -----------------------------

@dataclass(frozen=True)
class ExecutionStep:
    """
    Represents one executable step in the workflow.

    This is already "runtime-ready":
    it contains resolved parameters, environment,
    final argv and output paths.
    """
    node_id: str
    name: str
    workdir: Optional[str]
    env: Dict[str, str]
    modules: List[str]
    library_paths: List[str]

    # final argv for execution
    argv: List[str]

    # resolved outputs: port_id -> path/value
    outputs: Dict[str, str]

    batch: BatchConfig
    dependencies: List[str]


@dataclass(frozen=True)
class ExecutionPlan:
    """
    Full execution plan for the workflow.
    Essentially just a list of ordered ExecutionSteps.
    """
    workflow_id: str
    workflow_name: str
    workflow_backend: str
    results_root: Optional[str]
    steps: List[ExecutionStep]


# -----------------------------
# Helpers
# -----------------------------

def _slug(s: str) -> str:
    """
    Turn a name into something filesystem-safe.
    Mostly used for generating output directories/files.
    """
    s = s.strip().replace(" ", "_")
    return "".join(ch for ch in s if ch.isalnum() or ch in ("_", "-", ".")) or "task"


def _get_task(wf: WorkflowDoc, node_id: str) -> TaskNode:
    """
    Fetch task node and fail if it does not exist.
    """
    n = wf.nodes.get(node_id)
    if n is None or getattr(n, "type", None) != "task":
        raise KeyError(f"Task node not found: {node_id}")
    return n


def _task_param_map(task: TaskNode) -> Dict[str, TaskParam]:
    """
    Helper to build param lookup table.
    """
    return {p.id: p for p in task.task.params}


def _find_port(task: TaskNode, direction: str, port_id: str) -> Optional[IOPort]:
    """
    Find port by id on a task.
    """
    ports = task.task.io.outputs if direction == "output" else task.task.io.inputs
    for p in ports:
        if p.id == port_id:
            return p
    return None


def _default_output_path(
    results_root: Optional[str],
    task_name: str,
    port_name: str,
    data_type: str,
) -> Optional[str]:
    """
    Generate default output path if user did not provide one.

    Example:
        results/task_name/output_name.out
    """
    if not results_root:
        return None

    base = Path(results_root) / _slug(task_name)

    if data_type == "directory":
        return str(base / _slug(port_name))

    # simple default for most other types
    return str(base / f"{_slug(port_name)}.out")


def _resolve_path(results_root: Optional[str], value: str) -> str:
    """
    Resolve user-provided path.

    Rules:
    - absolute paths stay absolute
    - URLs stay unchanged
    - relative paths are resolved relative to results_root
    """
    v = (value or "").strip()
    if v == "":
        return ""

    if "://" in v:
        return v

    p = Path(v)
    if p.is_absolute():
        return str(p)

    if results_root is None:
        return str(p)

    return str(Path(results_root) / p)


def _initial_resolved_param_values(
    wf: WorkflowDoc,
) -> Dict[Tuple[str, str], str]:
    """
    Prepare initial parameter values before edge propagation.

    Only file/directory parameters are path-resolved here.
    """
    results_root = getattr(getattr(wf, "run", None), "resultsRoot", None)
    resolved: Dict[Tuple[str, str], str] = {}

    for node_id, task in wf.nodes.items():
        if task.type != "task":
            continue

        for p in task.task.params:
            raw = (p.value or "").strip()

            if raw == "":
                resolved[(node_id, p.id)] = ""
                continue

            if p.kind in ("file", "directory"):
                resolved[(node_id, p.id)] = _resolve_path(results_root, raw)
            else:
                resolved[(node_id, p.id)] = raw

    return resolved


# -----------------------------
# Core: resolve outputs and propagate along edges
# -----------------------------

def _resolve_output_value(
    wf: WorkflowDoc,
    task: TaskNode,
    out_port: IOPort,
    resolved_param_values: Dict[Tuple[str, str], str],
    results_root: Optional[str],
) -> str:
    """
    Determine value produced by an output port.
    """
    src = out_port.outputSource

    # no explicit source -> generate default path
    if src is None:
        auto = _default_output_path(results_root, task.name, out_port.name, out_port.dataType)
        return auto or ""

    if src.kind == "fromParam":
        key = (task.id, src.paramId)
        val = resolved_param_values.get(key, "").strip()

        # auto-create output path if empty
        if val == "" and out_port.dataType in ("file", "directory"):
            auto = _default_output_path(results_root, task.name, out_port.name, out_port.dataType) or ""
            resolved_param_values[key] = auto
            return auto

        return val

    if src.kind == "template":
        return src.template

    return ""


def _apply_edge_transfer(
    wf: WorkflowDoc,
    edge: WorkflowEdge,
    computed_outputs: Dict[Tuple[str, str], str],
    resolved_param_values: Dict[Tuple[str, str], str],
) -> None:
    """
    Transfer data from source output port to target input parameter.
    """
    if not edge.sourceHandle or not edge.targetHandle:
        return

    src_task = _get_task(wf, edge.source)
    dst_task = _get_task(wf, edge.target)

    out_port = _find_port(src_task, "output", edge.sourceHandle)
    in_port = _find_port(dst_task, "input", edge.targetHandle)
    if out_port is None or in_port is None:
        return

    out_val = computed_outputs.get((edge.source, out_port.id), "")
    if out_val == "":
        return

    bind = in_port.inputBind
    if bind is None or bind.kind != "param":
        return

    resolved_param_values[(edge.target, bind.paramId)] = out_val


def _resolve_binary_path(binary: str) -> str:
    """
    Resolve binary/tool path in a portable way.

    If the workflow contains an old absolute local path, but a script with the
    same filename exists in /app/demo_scripts, prefer that deployed demo script.
    """
    v = (binary or "").strip()
    if not v:
        return v

    p = Path(v)
    demo_candidate = Path("/app/demo_scripts") / p.name

    if demo_candidate.exists():
        return str(demo_candidate)

    return v

# -----------------------------
# Build argv for task
# -----------------------------

def _build_argv(
    task: TaskNode,
    resolved_param_values: Dict[Tuple[str, str], str],
) -> List[str]:
    """
    Construct final command-line arguments.

    Example output:
        [binaryPath, --flag1, value1, --flag2, value2]
    """
    argv: List[str] = []
    binary = _resolve_binary_path(task.task.config.binaryPath.strip())

    if binary.endswith(".py"):
        argv.append("python3")
    argv.append(binary)

    for p in task.task.params:
        flag = (p.flag or "").strip()
        val = resolved_param_values.get((task.id, p.id), "").strip()

        if not flag:
            continue

        # bool params behave like typical CLI flags
        if p.kind == "bool":
            if val.lower() in ("true", "1", "yes", "on"):
                argv.append(flag)
            continue

        if val == "":
            continue

        if flag.endswith("="):
            argv.append(f"{flag}{val}")
        else:
            argv.append(flag)
            argv.append(val)

    return argv


def _dependencies_for_node(wf: WorkflowDoc, node_id: str) -> List[str]:
    deps = []
    for e in wf.edges.values():
        if e.target == node_id and e.source != node_id:
            deps.append(e.source)
    return sorted(set(deps))

# -----------------------------
# Public API
# -----------------------------

def build_execution_plan(wf: WorkflowDoc, ordered_task_ids: List[str]) -> ExecutionPlan:
    """
    Build the full execution plan for a workflow.

    Steps:
    1. initialize param values
    2. compute outputs of tasks
    3. propagate values along edges
    4. build ExecutionStep objects
    """
    results_root = getattr(getattr(wf, "run", None), "resultsRoot", None)

    resolved_param_values = _initial_resolved_param_values(wf)
    computed_outputs: Dict[Tuple[str, str], str] = {}

    # resolve outputs and propagate them downstream
    for node_id in ordered_task_ids:
        task = _get_task(wf, node_id)

        for out_port in task.task.io.outputs:
            val = _resolve_output_value(
                wf=wf,
                task=task,
                out_port=out_port,
                resolved_param_values=resolved_param_values,
                results_root=results_root,
            )
            computed_outputs[(node_id, out_port.id)] = val

        for e in wf.edges.values():
            if e.source == node_id:
                _apply_edge_transfer(
                    wf=wf,
                    edge=e,
                    computed_outputs=computed_outputs,
                    resolved_param_values=resolved_param_values,
                )

    # build final execution steps
    steps: List[ExecutionStep] = []
    for node_id in ordered_task_ids:
        task = _get_task(wf, node_id)

        env = {v.key: v.value for v in task.task.environment.variables}
        modules = list(task.task.environment.modules)
        libs = list(task.task.environment.libraries)

        outputs: Dict[str, str] = {}
        for out_port in task.task.io.outputs:
            outputs[out_port.id] = computed_outputs.get((node_id, out_port.id), "")

        workdir = _resolve_path(results_root, task.task.config.workdir or "") or None

        steps.append(
            ExecutionStep(
                node_id=node_id,
                name=task.name,
                workdir=workdir,
                env=env,
                modules=modules,
                library_paths=libs,
                argv=_build_argv(task, resolved_param_values),
                outputs=outputs,
                batch=task.task.batch,
                dependencies=_dependencies_for_node(wf, node_id),
            )
        )

    workflow_backend = getattr(getattr(wf, "run", None), "backend", "local")

    return ExecutionPlan(
        workflow_id=wf.id,
        workflow_name=wf.name,
        workflow_backend=workflow_backend,
        results_root=results_root,
        steps=steps,
    )