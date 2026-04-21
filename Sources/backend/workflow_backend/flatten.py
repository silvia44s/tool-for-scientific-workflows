"""
@file flatten.py
@author Silvia Šlachtovská
@brief Utilities for flattening nested workflows into a single executable graph.

This module transforms workflow documents containing subworkflows into a flat
workflow representation containing only task nodes and concrete edges between
their ports. It also builds boundary mappings so parent workflows can connect
to nested inputs and outputs consistently.
"""
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
    """
    @brief Internal flattened representation of a workflow subtree.

    Stores the flattened task nodes and edges produced from a workflow or
    subworkflow, together with mappings that describe how exposed boundary
    ports connect to the flattened internal task endpoints.
    """
    nodes: Dict[str, TaskNode]
    edges: Dict[str, WorkflowEdge]

    # subworkflow input port -> list of flattened target endpoints
    input_map: Dict[str, List[Tuple[str, str]]]

    # subworkflow output port -> flattened source endpoint
    output_map: Dict[str, Tuple[str, str]]


def _pref(prefix: str, value: str) -> str:
    """
    @brief Builds a prefixed identifier for flattened workflow objects.

    Prefixes nested node and edge identifiers using a double-underscore
    separator so the flattened graph keeps stable and unique IDs.

    @param prefix Current parent prefix.
    @param value Local identifier to prefix.
    @return Prefixed identifier or the original value if the prefix is empty.
    """
    return f"{prefix}__{value}" if prefix else value


def flatten_workflow(workflow: WorkflowDoc) -> WorkflowDoc:
    """
    @brief Flattens a workflow document containing nested subworkflows.

    Produces a new workflow document with the same top-level metadata but with
    all nested subworkflow contents expanded into a single graph of task nodes
    and concrete edges.

    @param workflow Workflow document to flatten.
    @return Flattened workflow document ready for validation and execution planning.
    """
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
    """
    @brief Rebuilds boundary port mappings for a flattened subworkflow node.

    Converts the internal flattened mappings of a nested subworkflow so they
    match the boundary port identifiers exposed by the containing subworkflow node.

    @param node Original subworkflow node containing boundary definitions.
    @param inner Flattened representation of the nested workflow body.
    @param prefix Prefix assigned to the current subworkflow instance.
    @return Flattened subworkflow with remapped boundary input and output maps.
    """
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
    """
    @brief Recursively flattens one workflow level and all nested subworkflows.

    The function expands nested subworkflows into task nodes, rewrites edge
    endpoints to reference flattened task ports and builds interface mappings
    that allow parent workflows to connect to exposed boundary ports.

    @param workflow Workflow document to flatten.
    @param prefix Prefix applied to identifiers at the current nesting level.
    @return Flattened workflow subtree including nodes, edges and boundary maps.
    @raises ValueError If an edge references a missing node or unresolved boundary port.
    """
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
    """
    @brief Resolves the flattened source endpoint for an edge source.

    Task nodes resolve directly to their prefixed output handle. Subworkflow
    nodes resolve through their flattened boundary output mapping.

    @param node Source workflow node.
    @param node_id Source node identifier at the current workflow level.
    @param handle Source port handle.
    @param prefix Current nesting prefix.
    @param flattened_subs Already flattened nested subworkflows on this level.
    @return List containing the resolved flattened source endpoint.
    @raises ValueError If a subworkflow source handle is missing or unmapped.
    """
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
    """
    @brief Resolves flattened target endpoints for an edge target.

    Task nodes resolve directly to their prefixed input handle. Subworkflow
    nodes may resolve to one or more internal flattened task inputs through
    their boundary input mapping.

    @param node Target workflow node.
    @param node_id Target node identifier at the current workflow level.
    @param handle Target port handle.
    @param prefix Current nesting prefix.
    @param flattened_subs Already flattened nested subworkflows on this level.
    @return List of resolved flattened target endpoints.
    @raises ValueError If a subworkflow target handle is missing or unmapped.
    """
    if node.type == "task":
        return [(_pref(prefix, node_id), handle)]

    if handle is None:
        raise ValueError(f"Subworkflow target '{node_id}' missing targetHandle.")

    flattened = flattened_subs[node_id]
    mapped = flattened.input_map.get(handle)
    if not mapped:
        raise ValueError(
            f"Subworkflow '{node_id}' target port '{handle}' has no boundary input mapping."
        )

    return mapped