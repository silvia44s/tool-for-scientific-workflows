from __future__ import annotations

import copy

import pytest

from workflow_backend.validate import validate_workflow, WorkflowValidationError
from workflow_backend.flatten import flatten_workflow
from workflow_backend.models import WorkflowDoc


def test_validate_demo_numbers_passes(demo_numbers_wf):
    validate_workflow(demo_numbers_wf)


def test_validate_flattened_subworkflow_passes(demo_subworkflow_wf):
    flat = flatten_workflow(demo_subworkflow_wf)
    validate_workflow(flat)


def test_validate_empty_workflow_fails(demo_numbers_dict):
    wf = copy.deepcopy(demo_numbers_dict)
    wf["nodes"] = {}
    wf["edges"] = {}

    doc = WorkflowDoc.model_validate(wf)

    with pytest.raises(WorkflowValidationError) as exc:
        validate_workflow(doc)

    assert "WF_EMPTY" in str(exc.value)


def test_validate_missing_run_config_fails(demo_numbers_dict):
    wf = copy.deepcopy(demo_numbers_dict)
    wf["run"] = None

    doc = WorkflowDoc.model_validate(wf)

    with pytest.raises(WorkflowValidationError) as exc:
        validate_workflow(doc)

    assert "WF_RUN_MISSING" in str(exc.value)


def test_validate_missing_source_handle_fails(demo_numbers_dict):
    wf = copy.deepcopy(demo_numbers_dict)
    wf["edges"]["edge_1"]["sourceHandle"] = None

    doc = WorkflowDoc.model_validate(wf)

    with pytest.raises(WorkflowValidationError) as exc:
        validate_workflow(doc)

    assert "EDGE_HANDLE_MISSING" in str(exc.value)


def test_validate_duplicate_input_connection_fails(demo_numbers_dict):
    wf = copy.deepcopy(demo_numbers_dict)
    wf["edges"]["edge_3"] = {
        "id": "edge_3",
        "source": "node_1",
        "target": "node_2",
        "sourceHandle": "out_p1_out",
        "targetHandle": "in_p2_in",
    }

    doc = WorkflowDoc.model_validate(wf)

    with pytest.raises(WorkflowValidationError) as exc:
        validate_workflow(doc)

    assert "EDGE_MULTIPLE_TO_INPUT" in str(exc.value)


def test_validate_type_mismatch_fails(demo_numbers_dict):
    wf = copy.deepcopy(demo_numbers_dict)
    wf["nodes"]["node_2"]["task"]["io"]["inputs"][0]["dataType"] = "number"

    doc = WorkflowDoc.model_validate(wf)

    with pytest.raises(WorkflowValidationError) as exc:
        validate_workflow(doc)

    assert "EDGE_TYPE_MISMATCH" in str(exc.value)


def test_validate_required_param_without_value_or_edge_fails(demo_numbers_dict):
    wf = copy.deepcopy(demo_numbers_dict)
    del wf["edges"]["edge_1"]

    doc = WorkflowDoc.model_validate(wf)

    with pytest.raises(WorkflowValidationError) as exc:
        validate_workflow(doc)

    assert "PARAM_REQUIRED_EMPTY" in str(exc.value)


def test_validate_empty_binary_path_fails(demo_numbers_dict):
    wf = copy.deepcopy(demo_numbers_dict)
    wf["nodes"]["node_1"]["task"]["config"]["binaryPath"] = ""

    doc = WorkflowDoc.model_validate(wf)

    with pytest.raises(WorkflowValidationError) as exc:
        validate_workflow(doc)

    assert "TASK_BINARY_EMPTY" in str(exc.value)