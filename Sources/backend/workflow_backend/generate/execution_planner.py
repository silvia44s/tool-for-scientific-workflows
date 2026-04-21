"""
@file execution_planner.py
@author Silvia Šlachtovská
@brief Builds concrete runtime execution plans for validated workflows.

This module converts a validated workflow and a topologically ordered list
of task identifiers into execution-ready steps. It resolves parameter values,
task outputs, propagated edge values, command-line arguments and per-task
runtime metadata needed for script generation.
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
    @brief Fully resolved executable step for one workflow task.

    Stores the runtime-ready representation of a task including resolved
    environment variables, command-line arguments, output values, batch
    configuration and task dependencies.
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
    @brief Full execution plan for a workflow run.

    Contains workflow-level runtime metadata together with the ordered list
    of fully resolved execution steps.
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
    @brief Converts a string into a filesystem-safe identifier fragment.

    Used mainly for generating output directory and file names from task
    and port names.

    @param s Input string.
    @return Sanitized string safe for filesystem usage.
    """
    s = s.strip().replace(" ", "_")
    return "".join(ch for ch in s if ch.isalnum() or ch in ("_", "-", ".")) or "task"


def _get_task(wf: WorkflowDoc, node_id: str) -> TaskNode:
    """
    @brief Returns a task node by id.

    Ensures that the referenced node exists and is a task node.

    @param wf Workflow document containing the node graph.
    @param node_id Identifier of the requested node.
    @return Matching task node.
    @raises KeyError If the node does not exist or is not a task node.
    """
    n = wf.nodes.get(node_id)
    if n is None or getattr(n, "type", None) != "task":
        raise KeyError(f"Task node not found: {node_id}")
    return n


def _find_port(task: TaskNode, direction: str, port_id: str) -> Optional[IOPort]:
    """
    @brief Finds a task input or output port by identifier.

    @param task Task node to inspect.
    @param direction Port direction, expected to be "input" or "output".
    @param port_id Identifier of the requested port.
    @return Matching port object or None if the port does not exist.
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
    @brief Generates a default output path for a task output port.

    File outputs are assigned a default file path and directory outputs are
    assigned a default directory path under the workflow results root.

    @param results_root Root directory for workflow results.
    @param task_name Name of the producing task.
    @param port_name Name of the output port.
    @param data_type Declared output port data type.
    @return Generated output path or None if no results root is available.
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
    @brief Resolves a configured path into its runtime form.

    Absolute paths are preserved, URLs remain unchanged and relative paths
    are resolved against the workflow results root when available.

    @param results_root Root directory for workflow results.
    @param value Configured path value.
    @return Resolved path string.
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
    @brief Initializes resolved task parameter values before edge propagation.

    Reads parameter values directly from task definitions and resolves file
    and directory values against the workflow results root where needed.

    @param wf Workflow document to inspect.
    @return Mapping from (node id, param id) to the initial resolved value.
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
    @brief Resolves the concrete runtime value produced by one output port.

    Output values are derived either from an explicitly configured source,
    from a referenced parameter value or from an auto-generated default
    output path for file and directory outputs.

    @param wf Workflow document being planned.
    @param task Producing task node.
    @param out_port Output port to resolve.
    @param resolved_param_values Already resolved parameter values.
    @param results_root Root directory for workflow results.
    @return Resolved output value for the port.
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
    @brief Propagates a resolved output value across one workflow edge.

    If the edge connects a source output port to a target input port bound
    to a parameter, the resolved source output value is copied into the
    target parameter value table.

    @param wf Workflow document containing the edge endpoints.
    @param edge Workflow edge describing the transfer.
    @param computed_outputs Already resolved task output values.
    @param resolved_param_values Mutable table of resolved parameter values.
    @return None
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
    @brief Resolves the executable path used for a task command.

    Preserves the configured binary path in general, but prefers a matching
    deployed demo script from /app/demo_scripts when available.

    @param binary Configured binary or script path.
    @return Resolved executable path.
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
    @brief Builds the final command-line argument vector for a task.

    Resolves the executable path and appends task parameters according to
    their configured flags, kinds and resolved runtime values.

    @param task Task node to convert into a command line.
    @param resolved_param_values Table of resolved parameter values.
    @return Final argv list ready for script generation or execution.
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
    """
    @brief Collects direct upstream task dependencies for a node.

    Dependencies are derived from incoming workflow edges whose source differs
    from the target node.

    @param wf Workflow document containing the edge graph.
    @param node_id Identifier of the node whose dependencies should be collected.
    @return Sorted list of unique upstream node identifiers.
    """
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
    @brief Builds the full runtime execution plan for a workflow.

    Initializes task parameter values, resolves output values, propagates
    data across workflow edges and produces ordered execution steps with
    fully prepared runtime metadata and command-line arguments.

    @param wf Validated workflow document.
    @param ordered_task_ids Task node identifiers in execution order.
    @return Fully resolved execution plan for script generation or execution.
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