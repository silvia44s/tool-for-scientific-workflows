"""
Simple task planner for workflows.

The job of this module is basically:
1. build a graph of task dependencies
2. detect obvious problems (missing nodes, cycles)
3. produce a valid execution order of tasks


"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Set, Tuple, Iterable


class PlanError(Exception):
    """Base exception for planning errors."""


class UnknownNodeError(PlanError):
    """
    Raised when an edge references a node that does not exist.

    This usually means the workflow JSON is inconsistent.
    """
    def __init__(self, edge_id: str, which: str, node_id: str) -> None:
        super().__init__(f"Edge '{edge_id}' references unknown {which} node '{node_id}'.")


class CycleError(PlanError):
    """
    Raised when the workflow graph contains a cycle.

    Workflows are expected to be DAGs (directed acyclic graphs),
    so cycles would break execution ordering.
    """
    def __init__(self, cycle_nodes: List[str]) -> None:
        msg = "Workflow graph contains a cycle. Involved nodes: " + " -> ".join(cycle_nodes)
        super().__init__(msg)
        self.cycle_nodes = cycle_nodes


@dataclass(frozen=True)
class PlannedTask:
    """
    Minimal representation of a planned task.

    At the moment it only stores the node id,
    but it could later include more info (command, env, etc.).
    """
    node_id: str


def _stable_sorted(items: Iterable[str]) -> List[str]:
    """
    Small helper to keep ordering deterministic.

    Sorting ensures the same workflow always produces
    the same execution order across runs.
    """
    return sorted(items)


def build_task_graph(workflow) -> Tuple[List[str], Dict[str, Set[str]], Dict[str, Set[str]]]:
    """
    Build a dependency graph between tasks.

    Returns:
        task_ids : list of all task nodes
        succ     : adjacency list (node -> successors)
        pred     : reverse adjacency (node -> predecessors)
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
    Compute execution order using Kahn's algorithm.

    If a cycle exists, the algorithm cannot finish and
    we raise CycleError.

    Returns:
        List of node ids in execution order.
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
    High-level planner entry point.

    Converts node ordering into PlannedTask objects.
    """
    return [PlannedTask(node_id=nid) for nid in topological_order(workflow)]