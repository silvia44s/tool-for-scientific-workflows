"""
@file planner.py
@author Silvia Šlachtovská
@brief Task dependency planner for workflow execution.

This module builds a dependency graph between workflow task nodes,
detects invalid references and cycles, and produces a deterministic
topological execution order for the executable tasks in the workflow.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Set, Tuple, Iterable


class PlanError(Exception):
    """
    @brief Base exception for workflow planning errors.
    """


class UnknownNodeError(PlanError):
    """
    @brief Raised when an edge references a node that does not exist.

    This usually indicates an inconsistent workflow graph where an edge
    points to a missing source or target node.
    """
    def __init__(self, edge_id: str, which: str, node_id: str) -> None:
        super().__init__(f"Edge '{edge_id}' references unknown {which} node '{node_id}'.")


class CycleError(PlanError):
    """
    @brief Raised when the workflow graph contains a dependency cycle.

    Workflow execution order is computed under the assumption that the task
    graph is acyclic. A cycle makes topological ordering impossible.
    """
    def __init__(self, cycle_nodes: List[str]) -> None:
        msg = "Workflow graph contains a cycle. Involved nodes: " + " -> ".join(cycle_nodes)
        super().__init__(msg)
        self.cycle_nodes = cycle_nodes


@dataclass(frozen=True)
class PlannedTask:
    """
    @brief Minimal representation of a task scheduled for execution.

    Currently stores only the task node identifier produced by the planner,
    but may later be extended with additional execution-related metadata.
    """
    node_id: str


def _stable_sorted(items: Iterable[str]) -> List[str]:
    """
    @brief Returns items in deterministic sorted order.

    Sorting is used to keep planning results stable across runs when multiple
    valid traversal orders are possible.

    @param items Iterable of node identifiers.
    @return Sorted list of identifiers.
    """
    return sorted(items)


def build_task_graph(workflow) -> Tuple[List[str], Dict[str, Set[str]], Dict[str, Set[str]]]:
    """
    @brief Builds the task dependency graph from a workflow document.

    Extracts task nodes from the workflow and creates forward and reverse
    adjacency mappings based on workflow edges. Edges referencing missing
    nodes are rejected. Edges touching non-task nodes are ignored.

    @param workflow Workflow document to analyze.
    @return Tuple containing the list of task ids, successor mapping and
        predecessor mapping.
    @raises UnknownNodeError If an edge references a missing source or target node.
    """
    nodes = workflow.nodes
    edges = workflow.edges

    # collect only task nodes
    task_ids = [nid for nid, n in nodes.items() if n.type == "task"]

    succ: Dict[str, Set[str]] = {nid: set() for nid in task_ids}
    pred: Dict[str, Set[str]] = {nid: set() for nid in task_ids}

    for edge_id, e in edges.items():
        src = e.source
        dst = e.target

        # check that nodes exist
        src_node = nodes.get(src)
        dst_node = nodes.get(dst)

        if src_node is None:
            raise UnknownNodeError(edge_id=edge_id, which="source", node_id=src)

        if dst_node is None:
            raise UnknownNodeError(edge_id=edge_id, which="target", node_id=dst)

        # ignore edges touching non-task nodes
        # (might change later if other node types appear)
        if src_node.type != "task" or dst_node.type != "task":
            continue

        succ[src].add(dst)
        pred[dst].add(src)

    return task_ids, succ, pred


def topological_order(workflow) -> List[str]:
    """
    @brief Computes a deterministic topological execution order of tasks.

    Uses Kahn's algorithm to order task nodes according to their dependencies.
    If the workflow contains a cycle, planning fails with a CycleError.

    @param workflow Workflow document to plan.
    @return List of task node identifiers in execution order.
    @raises UnknownNodeError If an edge references a missing node.
    @raises CycleError If the workflow graph contains a cycle.
    """
    task_ids, succ, pred = build_task_graph(workflow)

    # number of incoming edges for each node
    indeg: Dict[str, int] = {nid: len(pred[nid]) for nid in task_ids}

    # start with nodes that have no dependencies
    ready = _stable_sorted([nid for nid in task_ids if indeg[nid] == 0])

    order: List[str] = []

    # process nodes until none remain
    while ready:
        u = ready.pop(0)
        order.append(u)

        for v in _stable_sorted(succ[u]):
            indeg[v] -= 1
            if indeg[v] == 0:
                ready.append(v)
                ready.sort()

    # if not all nodes processed → cycle exists
    if len(order) != len(task_ids):
        stuck = [nid for nid in task_ids if indeg[nid] > 0]
        raise CycleError(cycle_nodes=_stable_sorted(stuck))

    return order


def plan_tasks(workflow) -> List[PlannedTask]:
    """
    @brief Produces planned task objects for workflow execution.

    Converts the computed topological ordering of task node identifiers into
    PlannedTask instances used by later execution-planning steps.

    @param workflow Workflow document to plan.
    @return List of planned tasks in execution order.
    @raises UnknownNodeError If an edge references a missing node.
    @raises CycleError If the workflow graph contains a cycle.
    """
    return [PlannedTask(node_id=nid) for nid in topological_order(workflow)]