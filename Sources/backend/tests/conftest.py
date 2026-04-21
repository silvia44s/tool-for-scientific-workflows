from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from workflow_backend.models import WorkflowDoc


TESTS_DIR = Path(__file__).resolve().parent
FIXTURES_DIR = TESTS_DIR / "fixtures" / "workflows"


def load_workflow_json(name: str) -> dict:
    path = FIXTURES_DIR / name
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_workflow_doc(name: str) -> WorkflowDoc:
    data = load_workflow_json(name)
    return WorkflowDoc.model_validate(data)


@pytest.fixture
def demo_numbers_dict() -> dict:
    return copy.deepcopy(load_workflow_json("demo_numbers.json"))


@pytest.fixture
def demo_numbers_wf() -> WorkflowDoc:
    return load_workflow_doc("demo_numbers.json")


@pytest.fixture
def demo_subworkflow_dict() -> dict:
    return copy.deepcopy(load_workflow_json("demo_subworkflow.json"))


@pytest.fixture
def demo_subworkflow_wf() -> WorkflowDoc:
    return load_workflow_doc("demo_subworkflow.json")


@pytest.fixture
def invalid_cycle_dict() -> dict:
    return copy.deepcopy(load_workflow_json("invalid_cycle.json"))


@pytest.fixture
def invalid_cycle_wf() -> WorkflowDoc:
    return load_workflow_doc("invalid_cycle.json")


@pytest.fixture
def invalid_missing_node_dict() -> dict:
    return copy.deepcopy(load_workflow_json("invalid_random_nodes.json"))


@pytest.fixture
def invalid_missing_node_wf() -> WorkflowDoc:
    return load_workflow_doc("invalid_random_nodes.json")

@pytest.fixture
def pbs_single_task_dict() -> dict:
    return copy.deepcopy(load_workflow_json("pbs_single_task.json"))


@pytest.fixture
def pbs_single_task_wf() -> WorkflowDoc:
    return load_workflow_doc("pbs_single_task.json")


@pytest.fixture
def slurm_single_task_dict() -> dict:
    return copy.deepcopy(load_workflow_json("slurm_single_task.json"))


@pytest.fixture
def slurm_single_task_wf() -> WorkflowDoc:
    return load_workflow_doc("slurm_single_task.json")