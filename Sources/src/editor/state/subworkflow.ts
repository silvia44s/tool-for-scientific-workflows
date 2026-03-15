import type {
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  TaskNode,
  Vec2,
  IOPort,
  SubworkflowNode,
} from './model';

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

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

export type CreateSubworkflowResult = {
  workflow: Workflow;
  createdNodeId: string | null;
};

export type UngroupSubworkflowResult = {
  workflow: Workflow;
  restoredNodeIds: string[];
};

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

function offsetNodePositions<T extends WorkflowNode>(nodes: T[], offset: Vec2): T[] {
  return nodes.map((n) => ({
    ...n,
    position: {
      x: n.position.x + offset.x,
      y: n.position.y + offset.y,
    },
  }));
}

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
