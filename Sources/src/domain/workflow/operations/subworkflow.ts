/**
 * @file subworkflow.ts
 * @brief Domain operations for grouping and ungrouping subworkflow nodes.
 * @author Silvia Šlachtovská
 *
 * This file contains pure functions for creating a nested subworkflow
 * from a selected set of task nodes and for restoring its internal nodes
 * back into the parent workflow.
 */

import type {
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  TaskNode,
  Vec2,
  IOPort,
  SubworkflowNode,
} from '../model/model';

/**
 * @brief Generates a unique identifier with the given prefix.
 *
 * @param prefix Prefix describing the identifier kind.
 * @return Generated unique identifier.
 */
function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * @brief Computes the geometric center of a set of workflow nodes.
 *
 * The function averages node positions and is used when placing a newly
 * created subworkflow node.
 *
 * @param nodes Nodes whose center should be calculated.
 * @return Average node position.
 */
function centerOfNodes(nodes: WorkflowNode[]): Vec2 {
  if (nodes.length === 0) return { x: 0, y: 0 };

  const sum = nodes.reduce(
    (acc, n) => {
      acc.x += n.position.x;
      acc.y += n.position.y;
      return acc;
    },
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / nodes.length,
    y: sum.y / nodes.length,
  };
}

/**
 * @brief Result of creating a subworkflow from a selection.
 *
 * Contains the updated workflow and the identifier of the newly created
 * subworkflow node, or null if grouping was not possible.
 */
export type CreateSubworkflowResult = {
  workflow: Workflow;
  createdNodeId: string | null;
};

/**
 * @brief Result of ungrouping a subworkflow node.
 *
 * Contains the updated workflow and identifiers of the restored nodes.
 */
export type UngroupSubworkflowResult = {
  workflow: Workflow;
  restoredNodeIds: string[];
};

/**
 * @brief Creates a subworkflow node from a selected set of task nodes.
 *
 * Selected task nodes and their internal edges are moved into a nested workflow.
 * Incoming and outgoing edges are converted into public subworkflow ports
 * and boundary mappings are created to preserve data flow.
 *
 * @param workflow Parent workflow to transform.
 * @param selectedNodeIds Identifiers of selected nodes to group.
 * @param position Optional position of the created subworkflow node.
 * @return Result containing the updated workflow and identifier of the new subworkflow node.
 */
export function createSubworkflowFromSelection(
  workflow: Workflow,
  selectedNodeIds: string[],
  position?: Vec2
): CreateSubworkflowResult {
  const selectedSet = new Set(selectedNodeIds);

  const selectedNodes = Object.values(workflow.nodes).filter(
    (n): n is TaskNode => selectedSet.has(n.id) && n.type === 'task'
  );

  if (selectedNodes.length < 2) {
    return {
      workflow,
      createdNodeId: null,
    };
  }

  const edges = Object.values(workflow.edges);

  const internalEdges: WorkflowEdge[] = [];
  const incomingEdges: WorkflowEdge[] = [];
  const outgoingEdges: WorkflowEdge[] = [];
  const untouchedEdges: WorkflowEdge[] = [];

  for (const e of edges) {
    const sourceInside = selectedSet.has(e.source);
    const targetInside = selectedSet.has(e.target);

    if (sourceInside && targetInside) {
      internalEdges.push(e);
    } else if (!sourceInside && targetInside) {
      incomingEdges.push(e);
    } else if (sourceInside && !targetInside) {
      outgoingEdges.push(e);
    } else {
      untouchedEdges.push(e);
    }
  }

  const innerNodes = Object.fromEntries(
    selectedNodes.map((n) => [n.id, n])
  );

  const innerEdges = Object.fromEntries(
    internalEdges.map((e) => [e.id, e])
  );

  const subworkflowId = uid('subworkflow');
  const subworkflowPosition = position ?? centerOfNodes(selectedNodes);

  const subInputs: IOPort[] = [];
  const subOutputs: IOPort[] = [];

  const boundaryInputs: SubworkflowNode['subworkflow']['boundary']['inputs'] = [];
  const boundaryOutputs: SubworkflowNode['subworkflow']['boundary']['outputs'] = [];

  const parentEdges: Record<string, WorkflowEdge> = Object.fromEntries(
    untouchedEdges.map((e) => [e.id, e])
  );

  // Incoming edges -> subworkflow inputs
  for (const e of incomingEdges) {
    const targetNode = workflow.nodes[e.target];
    if (!targetNode || targetNode.type !== 'task' || !e.targetHandle) continue;

    const internalPort = targetNode.task.io.inputs.find((p) => p.id === e.targetHandle);
    if (!internalPort) continue;

    const subPortId = uid('sw_in');

    subInputs.push({
      id: subPortId,
      name: internalPort.name || 'input',
      direction: 'input',
      dataType: internalPort.dataType,
    });

    boundaryInputs.push({
      portId: subPortId,
      targetNodeId: e.target,
      targetPortId: e.targetHandle,
    });

    const newEdgeId = uid('edge');
    parentEdges[newEdgeId] = {
      id: newEdgeId,
      source: e.source,
      target: subworkflowId,
      sourceHandle: e.sourceHandle,
      targetHandle: subPortId,
    };
  }

  // Outgoing edges -> subworkflow outputs
  for (const e of outgoingEdges) {
    const sourceNode = workflow.nodes[e.source];
    if (!sourceNode || sourceNode.type !== 'task' || !e.sourceHandle) continue;

    const internalPort = sourceNode.task.io.outputs.find((p) => p.id === e.sourceHandle);
    if (!internalPort) continue;

    const subPortId = uid('sw_out');

    subOutputs.push({
      id: subPortId,
      name: internalPort.name || 'output',
      direction: 'output',
      dataType: internalPort.dataType,
    });

    boundaryOutputs.push({
      portId: subPortId,
      sourceNodeId: e.source,
      sourcePortId: e.sourceHandle,
    });

    const newEdgeId = uid('edge');
    parentEdges[newEdgeId] = {
      id: newEdgeId,
      source: subworkflowId,
      target: e.target,
      sourceHandle: subPortId,
      targetHandle: e.targetHandle,
    };
  }

  const subworkflowNode: SubworkflowNode = {
    id: subworkflowId,
    type: 'subworkflow',
    name: 'New subworkflow',
    description: 'Nested workflow',
    position: subworkflowPosition,
    subworkflow: {
      workflow: {
        schemaVersion: 1,
        id: uid('wf'),
        name: 'Nested workflow',
        run: workflow.run,
        canvas: {
          viewport: { x: 0, y: 0, zoom: 1 },
        },
        nodes: innerNodes,
        edges: innerEdges,
      },
      io: {
        inputs: subInputs,
        outputs: subOutputs,
      },
      boundary: {
        inputs: boundaryInputs,
        outputs: boundaryOutputs,
      },
    },
  };

  const remainingNodes = Object.fromEntries(
    Object.entries(workflow.nodes).filter(([id]) => !selectedSet.has(id))
  );

  return {
    workflow: {
      ...workflow,
      nodes: {
        ...remainingNodes,
        [subworkflowNode.id]: subworkflowNode,
      },
      edges: parentEdges,
    },
    createdNodeId: subworkflowNode.id,
  };
}

/**
 * @brief Offsets positions of a set of nodes by a given vector.
 *
 * Used when restoring nodes from a subworkflow back into the parent workflow.
 *
 * @param nodes Nodes whose positions should be shifted.
 * @param offset Position offset to apply.
 * @return New array of shifted nodes.
 */
function offsetNodePositions<T extends WorkflowNode>(nodes: T[], offset: Vec2): T[] {
  return nodes.map((n) => ({
    ...n,
    position: {
      x: n.position.x + offset.x,
      y: n.position.y + offset.y,
    },
  }));
}

/**
 * @brief Ungroups a subworkflow node back into its parent workflow.
 *
 * Internal nodes and edges are restored into the parent workflow,
 * parent-level incoming and outgoing edges are reconnected using
 * subworkflow boundary mappings, and the subworkflow node is removed.
 *
 * @param workflow Parent workflow containing the subworkflow node.
 * @param subworkflowNodeId Identifier of the subworkflow node to expand.
 * @return Result containing the updated workflow and restored node identifiers.
 */
export function ungroupSubworkflowNode(
  workflow: Workflow,
  subworkflowNodeId: string
): UngroupSubworkflowResult {
  const node = workflow.nodes[subworkflowNodeId];

  if (!node || node.type !== 'subworkflow') {
    return {
      workflow,
      restoredNodeIds: [],
    };
  }

  const innerWorkflow = node.subworkflow.workflow;
  const innerNodesArray = Object.values(innerWorkflow.nodes);
  const shiftedInnerNodes = offsetNodePositions(innerNodesArray, node.position);

  const restoredNodes: Record<string, WorkflowNode> = Object.fromEntries(
    shiftedInnerNodes.map((n) => [n.id, n])
  );

  const restoredEdges: Record<string, WorkflowEdge> = {
    ...innerWorkflow.edges,
  };

  const resultEdges: Record<string, WorkflowEdge> = {};

  for (const [edgeId, e] of Object.entries(workflow.edges)) {
    const isIncoming = e.target === subworkflowNodeId;
    const isOutgoing = e.source === subworkflowNodeId;

    // incoming edge: parent -> subworkflow input
    if (isIncoming) {
      const mapping = node.subworkflow.boundary.inputs.find(
        (b) => b.portId === e.targetHandle
      );

      if (!mapping) continue;

      resultEdges[edgeId] = {
        id: edgeId,
        source: e.source,
        target: mapping.targetNodeId,
        sourceHandle: e.sourceHandle,
        targetHandle: mapping.targetPortId,
      };
      continue;
    }

    // outgoing edge: subworkflow output -> parent
    if (isOutgoing) {
      const mapping = node.subworkflow.boundary.outputs.find(
        (b) => b.portId === e.sourceHandle
      );

      if (!mapping) continue;

      resultEdges[edgeId] = {
        id: edgeId,
        source: mapping.sourceNodeId,
        target: e.target,
        sourceHandle: mapping.sourcePortId,
        targetHandle: e.targetHandle,
      };
      continue;
    }

    // untouched parent edge
    resultEdges[edgeId] = e;
  }

  const { [subworkflowNodeId]: _, ...remainingParentNodes } = workflow.nodes;

  return {
    workflow: {
      ...workflow,
      nodes: {
        ...remainingParentNodes,
        ...restoredNodes,
      },
      edges: {
        ...resultEdges,
        ...restoredEdges,
      },
    },
    restoredNodeIds: Object.keys(restoredNodes),
  };
}