from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

from workflow_backend.models import (
    WorkflowDoc,
    WorkflowEdge,
    TaskNode,
    SubworkflowNode,
    WorkflowNode,
)


@dataclass
class FlattenedSubworkflow:
    nodes: Dict[str, TaskNode]
    edges: Dict[str, WorkflowEdge]

    # subworkflow input port -> list of flattened target endpoints
    input_map: Dict[str, List[Tuple[str, str]]]

    # subworkflow output port -> flattened source endpoint
    output_map: Dict[str, Tuple[str, str]]


def _pref(prefix: str, value: str) -> str:
    return f"{prefix}__{value}" if prefix else value


def flatten_workflow(workflow: WorkflowDoc) -> WorkflowDoc:
    flat = _flatten_workflow_doc(workflow, prefix="")

    return WorkflowDoc(
        schemaVersion=workflow.schemaVersion,
        id=workflow.id,
        name=workflow.name,
        run=workflow.run,
        canvas=workflow.canvas,
        nodes=flat.nodes,
        edges=flat.edges,
    )

def _wrap_subworkflow_interface(
    node: SubworkflowNode,
    inner: FlattenedSubworkflow,
    prefix: str,
) -> FlattenedSubworkflow:
    wrapped_input_map: Dict[str, List[Tuple[str, str]]] = {}
    wrapped_output_map: Dict[str, Tuple[str, str]] = {}

    for b in node.subworkflow.boundary.inputs:
        # boundary target may refer either to a direct task input
        # or to an already-exposed port of a nested subworkflow
        mapped_targets = inner.input_map.get(b.targetPortId)
        if mapped_targets is None:
            mapped_targets = [(_pref(prefix, b.targetNodeId), b.targetPortId)]

        wrapped_input_map[b.portId] = mapped_targets

    for b in node.subworkflow.boundary.outputs:
        mapped_source = inner.output_map.get(b.sourcePortId)
        if mapped_source is None:
            mapped_source = (_pref(prefix, b.sourceNodeId), b.sourcePortId)

        wrapped_output_map[b.portId] = mapped_source

    return FlattenedSubworkflow(
        nodes=inner.nodes,
        edges=inner.edges,
        input_map=wrapped_input_map,
        output_map=wrapped_output_map,
    )


def _flatten_workflow_doc(workflow: WorkflowDoc, prefix: str) -> FlattenedSubworkflow:
    flat_nodes: Dict[str, TaskNode] = {}
    flat_edges: Dict[str, WorkflowEdge] = {}

    # info about already-flattened nested subworkflows at this level
    flattened_subs: Dict[str, FlattenedSubworkflow] = {}

    # ---- 1) flatten nodes ----
    for node_id, node in workflow.nodes.items():
        flat_node_id = _pref(prefix, node_id)

        if node.type == "task":
            flat_task = node.model_copy(update={"id": flat_node_id})
            flat_nodes[flat_node_id] = flat_task

        elif node.type == "subworkflow":
            sub_prefix = flat_node_id

            inner_flattened = _flatten_workflow_doc(node.subworkflow.workflow, sub_prefix)
            flattened = _wrap_subworkflow_interface(node, inner_flattened, sub_prefix)

            flattened_subs[node_id] = flattened

            flat_nodes.update(flattened.nodes)
            flat_edges.update(flattened.edges)

    # ---- 2) flatten edges on this level ----
    for edge_id, edge in workflow.edges.items():
        src_node = workflow.nodes.get(edge.source)
        dst_node = workflow.nodes.get(edge.target)

        if not src_node or not dst_node:
            raise ValueError(f"Edge '{edge_id}' references missing node.")

        resolved_sources = _resolve_source_endpoint(
            src_node, edge.source, edge.sourceHandle, prefix, flattened_subs
        )
        resolved_targets = _resolve_target_endpoint(
            dst_node, edge.target, edge.targetHandle, prefix, flattened_subs
        )

        for si, (src_id, src_handle) in enumerate(resolved_sources):
            for ti, (dst_id, dst_handle) in enumerate(resolved_targets):
                new_edge_id = _pref(prefix, edge_id)
                if len(resolved_sources) > 1 or len(resolved_targets) > 1:
                    new_edge_id = f"{new_edge_id}__{si}_{ti}"

                flat_edges[new_edge_id] = WorkflowEdge(
                    id=new_edge_id,
                    source=src_id,
                    target=dst_id,
                    sourceHandle=src_handle,
                    targetHandle=dst_handle,
                )

    # ---- 3) build interface map for parent ----
    input_map: Dict[str, List[Tuple[str, str]]] = {}
    output_map: Dict[str, Tuple[str, str]] = {}

    for node_id, node in workflow.nodes.items():
        if node.type == "task":
            continue

        flattened = flattened_subs[node_id]

        for b in node.subworkflow.boundary.inputs:
            targets = flattened.input_map.get(b.targetPortId)
            if targets is None:
                # boundary can also point directly to a task inside
                flat_target_node = _pref(_pref(prefix, node_id), b.targetNodeId)
                targets = [(flat_target_node, b.targetPortId)]

            input_map.setdefault(b.portId, []).extend(targets)

        for b in node.subworkflow.boundary.outputs:
            source = flattened.output_map.get(b.sourcePortId)
            if source is None:
                flat_source_node = _pref(_pref(prefix, node_id), b.sourceNodeId)
                source = (flat_source_node, b.sourcePortId)

            output_map[b.portId] = source

    # expose direct task ports of this workflow level too
    for node_id, node in workflow.nodes.items():
        if node.type != "task":
            continue

        flat_node_id = _pref(prefix, node_id)

        for p in node.task.io.inputs:
            input_map.setdefault(p.id, []).append((flat_node_id, p.id))

        for p in node.task.io.outputs:
            output_map[p.id] = (flat_node_id, p.id)

    return FlattenedSubworkflow(
        nodes=flat_nodes,
        edges=flat_edges,
        input_map=input_map,
        output_map=output_map,
    )


def _resolve_source_endpoint(
    node: WorkflowNode,
    node_id: str,
    handle: str | None,
    prefix: str,
    flattened_subs: Dict[str, FlattenedSubworkflow],
) -> List[Tuple[str, str | None]]:
    if node.type == "task":
        return [(_pref(prefix, node_id), handle)]

    if handle is None:
        raise ValueError(f"Subworkflow source '{node_id}' missing sourceHandle.")

    flattened = flattened_subs[node_id]
    mapped = flattened.output_map.get(handle)
    if not mapped:
        raise ValueError(
            f"Subworkflow '{node_id}' source port '{handle}' has no boundary output mapping."
        )

    return [mapped]


def _resolve_target_endpoint(
    node: WorkflowNode,
    node_id: str,
    handle: str | None,
    prefix: str,
    flattened_subs: Dict[str, FlattenedSubworkflow],
) -> List[Tuple[str, str | None]]:
    if node.type == "task":
        return [(_pref(prefix, node_id), handle)]

    if handle is None:
        raise ValueError(f"Subworkflow target '{node_id}' missing targetHandle.")

    flattened = flattened_subs[node_id]
    mapped = flattened.input_map.get(handle)
    print("RESOLVE TARGET", node_id, handle, flattened.input_map)
    if not mapped:
        raise ValueError(
            f"Subworkflow '{node_id}' target port '{handle}' has no boundary input mapping."
        )

    return mapped