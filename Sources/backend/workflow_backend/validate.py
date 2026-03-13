"""
Validation helpers for workflow documents.

This file checks whether the workflow makes sense before execution.
So not just JSON shape validation, but also things like:
- edge references
- port compatibility
- duplicate connections
- required params
- broken param/port bindings
- basic batch config sanity
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Set, Tuple, List

from workflow_backend.models import WorkflowDoc, TaskNode, PortDataType, TaskParam, IOPort


@dataclass
class ValidationIssue:
    """
    Small container for one validation problem.
    Kept simple so it is easy to show in UI or logs.
    """
    code: str
    message: str


class WorkflowValidationError(Exception):
    """
    Raised when one or more validation issues were found.
    Combines all issues into one readable error message.
    """
    def __init__(self, issues: list[ValidationIssue]) -> None:
        self.issues = issues
        msg = "\n".join(f"[{i.code}] {i.message}" for i in issues)
        super().__init__(msg)


def _validate_batch_config(task: TaskNode, issues: List[ValidationIssue], backend: str) -> None:
    """
    Validate batch config sanity.

    This is intentionally lightweight:
    - numeric values should be positive
    - array settings should make sense
    - custom directive lines should roughly look like scheduler directives
    """
    batch = task.task.batch
    arr = batch.array

    if batch.cpus is not None and batch.cpus <= 0:
        issues.append(
            ValidationIssue(
                "BATCH_CPUS_INVALID",
                f"Task {task.id}: cpus must be > 0."
            )
        )

    if batch.memMB is not None and batch.memMB <= 0:
        issues.append(
            ValidationIssue(
                "BATCH_MEM_INVALID",
                f"Task {task.id}: memMB must be > 0."
            )
        )

    if batch.timeMin is not None and batch.timeMin <= 0:
        issues.append(
            ValidationIssue(
                "BATCH_TIME_INVALID",
                f"Task {task.id}: timeMin must be > 0."
            )
        )

    if arr and arr.enabled:
        if arr.start is None or arr.end is None:
            issues.append(
                ValidationIssue(
                    "BATCH_ARRAY_RANGE_MISSING",
                    f"Task {task.id}: batch array is enabled but start/end is missing."
                )
            )
        else:
            if arr.start > arr.end:
                issues.append(
                    ValidationIssue(
                        "BATCH_ARRAY_RANGE_INVALID",
                        f"Task {task.id}: batch array start ({arr.start}) is greater than end ({arr.end})."
                    )
                )

        if arr.step is not None and arr.step <= 0:
            issues.append(
                ValidationIssue(
                    "BATCH_ARRAY_STEP_INVALID",
                    f"Task {task.id}: batch array step must be > 0."
                )
            )

    # validate custom directives very lightly
    # supported:
    #   - raw scheduler flags starting with "-"
    #   - full lines starting with #SBATCH / #PBS
    custom_directives = (getattr(batch, "customDirectives", "") or "").strip()

    # backward compatibility with older model
    if not custom_directives:
        custom_directives = (getattr(batch, "custom", "") or "").strip()

    if custom_directives:
        expected_prefix = "#SBATCH" if backend == "slurm" else "#PBS" if backend == "pbs" else None

        for idx, raw in enumerate(custom_directives.splitlines(), start=1):
            line = raw.strip()
            if not line:
                continue

            ok = False
            if line.startswith("-"):
                ok = True
            elif expected_prefix and line.startswith(expected_prefix):
                ok = True

            if not ok:
                issues.append(
                    ValidationIssue(
                        "BATCH_CUSTOM_DIRECTIVE_INVALID",
                        f"Task {task.id}: custom directive line {idx} has invalid format: '{line}'. "
                        f"Use lines starting with '-' or '{expected_prefix}'."
                    )
                )

    # validate prologue / epilogue types lightly
    # no content restrictions here, only ensure these fields are strings if present
    prologue = getattr(batch, "prologue", None)
    epilogue = getattr(batch, "epilogue", None)

    if prologue is not None and not isinstance(prologue, str):
        issues.append(
            ValidationIssue(
                "BATCH_PROLOGUE_INVALID",
                f"Task {task.id}: prologue must be a string."
            )
        )

    if epilogue is not None and not isinstance(epilogue, str):
        issues.append(
            ValidationIssue(
                "BATCH_EPILOGUE_INVALID",
                f"Task {task.id}: epilogue must be a string."
            )
        )


def validate_workflow(wf: WorkflowDoc) -> None:
    """
    Main workflow validation entry point.

    This does a couple of checks:
    - basic workflow sanity
    - edge references to existing nodes/ports
    - duplicate or invalid connections
    - simple type compatibility between ports
    - task param validation
    - input/output port binding checks
    - basic task config validation
    - batch config validation

    Raises WorkflowValidationError if anything is wrong.
    """
    issues: list[ValidationIssue] = []

    # ---- basic checks
    if not wf.nodes:
        issues.append(ValidationIssue("WF_EMPTY", "Workflow has no nodes."))

    # ---- run config
    backend = "local"

    if wf.run is None:
        issues.append(ValidationIssue("WF_RUN_MISSING", "Workflow run configuration is missing."))
    else:
        backend = wf.run.backend
        if backend not in {"local", "slurm", "pbs"}:
            issues.append(ValidationIssue("WF_BACKEND_INVALID", f"Unsupported workflow backend '{backend}'."))

    # ---- pre-index ports + params for faster lookup
    out_ports: Dict[str, Dict[str, IOPort]] = {}
    in_ports: Dict[str, Dict[str, IOPort]] = {}
    params_by_node: Dict[str, Dict[str, TaskParam]] = {}

    for node_id, task in wf.nodes.items():
        out_ports[node_id] = {p.id: p for p in task.task.io.outputs}
        in_ports[node_id] = {p.id: p for p in task.task.io.inputs}
        params_by_node[node_id] = {p.id: p for p in task.task.params}

    # ---- validate edges
    seen_connections: Set[Tuple[str, str, str, str]] = set()
    incoming_to_input: Set[Tuple[str, str]] = set()  # (targetNodeId, targetHandle)

    for edge_id, e in wf.edges.items():
        if e.source not in wf.nodes:
            issues.append(
                ValidationIssue(
                    "EDGE_SOURCE_MISSING",
                    f"Edge {edge_id}: source node '{e.source}' does not exist."
                )
            )
            continue

        if e.target not in wf.nodes:
            issues.append(
                ValidationIssue(
                    "EDGE_TARGET_MISSING",
                    f"Edge {edge_id}: target node '{e.target}' does not exist."
                )
            )
            continue

        if not e.sourceHandle or not e.targetHandle:
            issues.append(
                ValidationIssue(
                    "EDGE_HANDLE_MISSING",
                    f"Edge {edge_id}: missing sourceHandle/targetHandle."
                )
            )
            continue

        if e.source == e.target:
            issues.append(
                ValidationIssue(
                    "EDGE_SELF_LOOP",
                    f"Edge {edge_id}: source and target are the same node '{e.source}'."
                )
            )
            continue

        src_port = out_ports[e.source].get(e.sourceHandle)
        dst_port = in_ports[e.target].get(e.targetHandle)

        if src_port is None:
            issues.append(
                ValidationIssue(
                    "EDGE_SOURCE_PORT_MISSING",
                    f"Edge {edge_id}: sourceHandle '{e.sourceHandle}' not found in outputs of node {e.source}."
                )
            )
            continue

        if dst_port is None:
            issues.append(
                ValidationIssue(
                    "EDGE_TARGET_PORT_MISSING",
                    f"Edge {edge_id}: targetHandle '{e.targetHandle}' not found in inputs of node {e.target}."
                )
            )
            continue

        if not _is_compatible(src_port.dataType, dst_port.dataType):
            issues.append(
                ValidationIssue(
                    "EDGE_TYPE_MISMATCH",
                    f"Edge {edge_id}: type mismatch {src_port.dataType} -> {dst_port.dataType} "
                    f"({e.source}:{src_port.id} -> {e.target}:{dst_port.id})."
                )
            )
            continue

        input_key = (e.target, e.targetHandle)
        if input_key in incoming_to_input:
            issues.append(
                ValidationIssue(
                    "EDGE_MULTIPLE_TO_INPUT",
                    f"Edge {edge_id}: input {e.target}:{e.targetHandle} already has a connection."
                )
            )
        else:
            incoming_to_input.add(input_key)

        key = (e.source, e.sourceHandle, e.target, e.targetHandle)
        if key in seen_connections:
            issues.append(
                ValidationIssue(
                    "EDGE_DUPLICATE",
                    f"Edge {edge_id}: duplicate connection {key}."
                )
            )
        else:
            seen_connections.add(key)

    # ---- validate task internals
    for node_id, task in wf.nodes.items():
        params = params_by_node[node_id]

        # basic task config checks
        binary = (task.task.config.binaryPath or "").strip()
        if not binary:
            issues.append(
                ValidationIssue(
                    "TASK_BINARY_EMPTY",
                    f"Task {task.id} has empty binaryPath."
                )
            )

        # validate task params
        _validate_params(
            task=task,
            params=params,
            incoming_to_input=incoming_to_input,
            issues=issues,
        )

        # validate batch config
        _validate_batch_config(task, issues, backend)

        # input ports should bind to a real param
        for p in task.task.io.inputs:
            if p.inputBind is None:
                issues.append(
                    ValidationIssue(
                        "PORT_INPUT_BIND_MISSING",
                        f"Task {task.id} input port '{p.id}' has no inputBind."
                    )
                )
                continue

            if p.inputBind.paramId not in params:
                issues.append(
                    ValidationIssue(
                        "PORT_INPUT_PARAM_MISSING",
                        f"Task {task.id} input port '{p.id}' binds to missing paramId '{p.inputBind.paramId}'."
                    )
                )

        # output ports should point somewhere valid
        for p in task.task.io.outputs:
            if p.outputSource is None:
                issues.append(
                    ValidationIssue(
                        "PORT_OUTPUT_SOURCE_MISSING",
                        f"Task {task.id} output port '{p.id}' has no outputSource."
                    )
                )
                continue

            if p.outputSource.kind == "fromParam" and p.outputSource.paramId not in params:
                issues.append(
                    ValidationIssue(
                        "PORT_OUTPUT_PARAM_MISSING",
                        f"Task {task.id} output port '{p.id}' refers to missing paramId '{p.outputSource.paramId}'."
                    )
                )

    if issues:
        raise WorkflowValidationError(issues)


def _is_compatible(src: PortDataType, dst: PortDataType) -> bool:
    """
    Simple port compatibility check.

    Right now this is strict equality only.
    Could be extended later if some implicit conversions make sense.
    """
    return src == dst


def _validate_params(
    task: TaskNode,
    params: Dict[str, TaskParam],
    incoming_to_input: Set[Tuple[str, str]],
    issues: List[ValidationIssue],
) -> None:
    """
    Validate task params one by one.

    Checks mainly:
    - required params
    - numeric values
    - bool values
    - choice membership

    A required param is also considered satisfied if its matching
    input port has an incoming edge.
    """
    input_port_by_param_id: Dict[str, IOPort] = {}

    for port in task.task.io.inputs:
        if port.inputBind and port.inputBind.kind == "param":
            input_port_by_param_id[port.inputBind.paramId] = port

    for p in params.values():
        v = (p.value or "").strip()

        has_incoming_edge = False
        input_port = input_port_by_param_id.get(p.id)
        if input_port is not None:
            has_incoming_edge = (task.id, input_port.id) in incoming_to_input

        if p.required and not v and not has_incoming_edge:
            issues.append(
                ValidationIssue(
                    "PARAM_REQUIRED_EMPTY",
                    f"Task {task.id} param '{p.name}' ({p.id}) is required but empty and has no incoming connection."
                )
            )
            continue

        if not v:
            continue

        if p.kind == "number":
            try:
                float(v)
            except ValueError:
                issues.append(
                    ValidationIssue(
                        "PARAM_NUMBER_INVALID",
                        f"Task {task.id} param '{p.name}' ({p.id}) expects number, got '{p.value}'."
                    )
                )

        elif p.kind == "bool":
            if v.lower() not in {"true", "false", "0", "1"}:
                issues.append(
                    ValidationIssue(
                        "PARAM_BOOL_INVALID",
                        f"Task {task.id} param '{p.name}' ({p.id}) expects bool (true/false/0/1), got '{p.value}'."
                    )
                )

        elif p.kind == "choice":
            if not p.options:
                issues.append(
                    ValidationIssue(
                        "PARAM_CHOICE_NO_OPTIONS",
                        f"Task {task.id} param '{p.name}' ({p.id}) is kind=choice but options is empty."
                    )
                )
            elif v not in p.options:
                issues.append(
                    ValidationIssue(
                        "PARAM_CHOICE_INVALID",
                        f"Task {task.id} param '{p.name}' ({p.id}) value '{p.value}' is not in options {p.options}."
                    )
                )

        elif p.kind in {"file", "directory", "string"}:
            pass