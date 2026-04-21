from __future__ import annotations

from workflow_backend.generate.planner import topological_order
from workflow_backend.generate.execution_planner import build_execution_plan
from workflow_backend.flatten import flatten_workflow


def test_execution_plan_basic_metadata(demo_numbers_wf):
    order = topological_order(demo_numbers_wf)
    plan = build_execution_plan(demo_numbers_wf, order)

    assert plan.workflow_id == "wf_demo_numbers"
    assert plan.workflow_name == "demo_numbers"
    assert plan.workflow_backend == "local"
    assert plan.results_root == "results"
    assert len(plan.steps) == 3


def test_execution_plan_step_names(demo_numbers_wf):
    order = topological_order(demo_numbers_wf)
    plan = build_execution_plan(demo_numbers_wf, order)

    assert [s.name for s in plan.steps] == [
        "Generate numbers",
        "Multiply numbers",
        "Summarize numbers",
    ]


def test_execution_plan_resolves_output_paths(demo_numbers_wf):
    order = topological_order(demo_numbers_wf)
    plan = build_execution_plan(demo_numbers_wf, order)

    step1 = plan.steps[0]
    assert step1.outputs["out_p1_out"] == "results/out/numbers.txt"


def test_execution_plan_propagates_edge_values(demo_numbers_wf):
    order = topological_order(demo_numbers_wf)
    plan = build_execution_plan(demo_numbers_wf, order)

    step2 = plan.steps[1]
    step3 = plan.steps[2]

    assert "--input" in step2.argv
    assert "results/out/numbers.txt" in step2.argv
    assert "results/out/multiplied.txt" in step3.argv


def test_execution_plan_dependencies(demo_numbers_wf):
    order = topological_order(demo_numbers_wf)
    plan = build_execution_plan(demo_numbers_wf, order)

    assert plan.steps[0].dependencies == []
    assert plan.steps[1].dependencies == ["node_1"]
    assert plan.steps[2].dependencies == ["node_2"]


def test_execution_plan_flattened_subworkflow(demo_subworkflow_wf):
    flat = flatten_workflow(demo_subworkflow_wf)
    order = topological_order(flat)
    plan = build_execution_plan(flat, order)

    names = [s.name for s in plan.steps]
    assert "Generate A" in names
    assert "Generate B" in names
    assert "Merge pairs" in names
    assert "Scale pairs" in names
    assert "Summarize pairs" in names
    assert len(plan.steps) == 5