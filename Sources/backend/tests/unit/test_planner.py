from __future__ import annotations

import copy

import pytest

from workflow_backend.models import WorkflowDoc
from workflow_backend.generate.planner import (
    build_task_graph,
    topological_order,
    plan_tasks,
    CycleError,
    UnknownNodeError,
)
from workflow_backend.flatten import flatten_workflow


def test_build_task_graph_demo_numbers(demo_numbers_wf):
    task_ids, succ, pred = build_task_graph(demo_numbers_wf)

    assert task_ids == ["node_1", "node_2", "node_3"]
    assert succ["node_1"] == {"node_2"}
    assert succ["node_2"] == {"node_3"}
    assert succ["node_3"] == set()
    assert pred["node_1"] == set()
    assert pred["node_2"] == {"node_1"}
    assert pred["node_3"] == {"node_2"}


def test_topological_order_demo_numbers(demo_numbers_wf):
    order = topological_order(demo_numbers_wf)
    assert order == ["node_1", "node_2", "node_3"]


def test_plan_tasks_demo_numbers(demo_numbers_wf):
    planned = plan_tasks(demo_numbers_wf)
    assert [p.node_id for p in planned] == ["node_1", "node_2", "node_3"]


def test_topological_order_cycle_raises(invalid_cycle_wf):
    with pytest.raises(CycleError):
        topological_order(invalid_cycle_wf)


def test_build_task_graph_unknown_target_raises(demo_numbers_dict):
    wf = copy.deepcopy(demo_numbers_dict)
    wf["edges"]["edge_1"]["target"] = "missing_node"

    doc = WorkflowDoc.model_validate(wf)

    with pytest.raises(UnknownNodeError):
        build_task_graph(doc)


def test_topological_order_flattened_subworkflow(demo_subworkflow_wf):
    flat = flatten_workflow(demo_subworkflow_wf)
    order = topological_order(flat)

    assert len(order) == 5
    assert order.index("node_1") < order.index("subworkflow_ec031fc83ba8e8_1776694540264__node_3")
    assert order.index("node_2") < order.index("subworkflow_ec031fc83ba8e8_1776694540264__node_3")
    assert order.index("subworkflow_ec031fc83ba8e8_1776694540264__node_3") < order.index("subworkflow_ec031fc83ba8e8_1776694540264__node_4")
    assert order.index("subworkflow_ec031fc83ba8e8_1776694540264__node_4") < order.index("node_5")