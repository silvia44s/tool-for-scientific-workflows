from __future__ import annotations

import pytest

from workflow_backend.flatten import flatten_workflow
from workflow_backend.validate import validate_workflow


def test_flatten_subworkflow_removes_subworkflow_nodes(demo_subworkflow_wf):
    flat = flatten_workflow(demo_subworkflow_wf)

    assert all(node.type == "task" for node in flat.nodes.values())
    assert len(flat.nodes) == 5


def test_flatten_subworkflow_creates_prefixed_internal_ids(demo_subworkflow_wf):
    flat = flatten_workflow(demo_subworkflow_wf)

    assert "subworkflow_ec031fc83ba8e8_1776694540264__node_3" in flat.nodes
    assert "subworkflow_ec031fc83ba8e8_1776694540264__node_4" in flat.nodes


def test_flatten_subworkflow_connects_parent_input_to_internal_node(demo_subworkflow_wf):
    flat = flatten_workflow(demo_subworkflow_wf)

    edge_targets = {
        (e.source, e.target, e.sourceHandle, e.targetHandle)
        for e in flat.edges.values()
    }

    assert (
        "node_1",
        "subworkflow_ec031fc83ba8e8_1776694540264__node_3",
        "out_p1_out",
        "in_p3_left",
    ) in edge_targets


def test_flatten_subworkflow_connects_internal_output_to_parent_target(demo_subworkflow_wf):
    flat = flatten_workflow(demo_subworkflow_wf)

    edge_targets = {
        (e.source, e.target, e.sourceHandle, e.targetHandle)
        for e in flat.edges.values()
    }

    assert (
        "subworkflow_ec031fc83ba8e8_1776694540264__node_4",
        "node_5",
        "out_p4_out",
        "in_p5_input",
    ) in edge_targets


def test_flattened_workflow_is_still_valid(demo_subworkflow_wf):
    flat = flatten_workflow(demo_subworkflow_wf)
    validate_workflow(flat)