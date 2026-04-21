/**
 * @file nodeOperations.ts
 * @brief Domain operations for creating, updating, and removing workflow nodes.
 * @author Silvia Šlachtovská
 *
 * This file contains pure functions for modifying workflow nodes and their positions.
 * The operations preserve workflow immutability and also maintain edge consistency
 * when nodes are removed.
 */

import type { TaskNode, Vec2, Workflow, WorkflowEdge, WorkflowNode } from '../model/model';
import { syncPortsForTask } from './taskPorts';
import { uid } from './workflowTree';

/**
 * @brief Creates a default task node at the given position.
 *
 * The node is initialized with empty execution configuration, no parameters,
 * and no environment setup. Task ports are synchronized after creation.
 *
 * @param position Initial canvas position of the new node.
 * @return Newly created default task node.
 */
export function createDefaultTaskNode(position: Vec2): TaskNode {
  const id = uid('node');

  const node: TaskNode = {
    id,
    type: 'task',
    name: 'Task',
    position,
    task: {
      config: { binaryPath: '', workdir: '', argsTemplate: '' },
      params: [],
      environment: { variables: [], modules: [], libraries: [] },
      io: { inputs: [], outputs: [] },
      batch: { array: { enabled: false } },
    },
  };

  return syncPortsForTask(node);
}

/**
 * @brief Adds one node to the workflow.
 *
 * @param activeWorkflow Workflow to update.
 * @param node Node to insert.
 * @return Updated workflow with the inserted node.
 */
export function addNode(
  activeWorkflow: Workflow,
  node: WorkflowNode
): Workflow {
  return {
    ...activeWorkflow,
    nodes: {
      ...activeWorkflow.nodes,
      [node.id]: node,
    },
  };
}

/**
 * @brief Adds multiple nodes to the workflow.
 *
 * Existing nodes with the same identifiers are overwritten.
 *
 * @param activeWorkflow Workflow to update.
 * @param nodesToAdd Nodes to insert.
 * @return Updated workflow with all provided nodes.
 */
export function addNodes(
  activeWorkflow: Workflow,
  nodesToAdd: WorkflowNode[]
): Workflow {
  const nextNodes = { ...activeWorkflow.nodes };

  for (const node of nodesToAdd) {
    nextNodes[node.id] = node;
  }

  return {
    ...activeWorkflow,
    nodes: nextNodes,
  };
}

/**
 * @brief Updates one node using a partial patch object.
 *
 * If the node does not exist, the original workflow is returned unchanged.
 *
 * @param activeWorkflow Workflow to update.
 * @param nodeId Identifier of the node to update.
 * @param patch Partial node properties to merge into the existing node.
 * @return Updated workflow.
 */
export function updateNode(
  activeWorkflow: Workflow,
  nodeId: string,
  patch: Partial<WorkflowNode>
): Workflow {
  const existing = activeWorkflow.nodes[nodeId];
  if (!existing) {
    return activeWorkflow;
  }

  const updated = {
    ...existing,
    ...patch,
  } as WorkflowNode;

  return {
    ...activeWorkflow,
    nodes: {
      ...activeWorkflow.nodes,
      [nodeId]: updated,
    },
  };
}

/**
 * @brief Updates the canvas position of one node.
 *
 * If the node does not exist, the original workflow is returned unchanged.
 *
 * @param activeWorkflow Workflow to update.
 * @param nodeId Identifier of the node to move.
 * @param position New node position.
 * @return Updated workflow.
 */
export function setNodePosition(
  activeWorkflow: Workflow,
  nodeId: string,
  position: Vec2
): Workflow {
  const existing = activeWorkflow.nodes[nodeId];
  if (!existing) {
    return activeWorkflow;
  }

  const updated = {
    ...existing,
    position,
  } as WorkflowNode;

  return {
    ...activeWorkflow,
    nodes: {
      ...activeWorkflow.nodes,
      [nodeId]: updated,
    },
  };
}

/**
 * @brief Removes one node and all incident edges from the workflow.
 *
 * @param activeWorkflow Workflow to update.
 * @param nodeId Identifier of the node to remove.
 * @return Updated workflow without the node and its related edges.
 */
export function removeNode(
  activeWorkflow: Workflow,
  nodeId: string
): Workflow {
  const { [nodeId]: _, ...restNodes } = activeWorkflow.nodes;

  const restEdges: Record<string, WorkflowEdge> = {};
  for (const [edgeId, edge] of Object.entries(activeWorkflow.edges)) {
    if (edge.source === nodeId) continue;
    if (edge.target === nodeId) continue;
    restEdges[edgeId] = edge;
  }

  return {
    ...activeWorkflow,
    nodes: restNodes,
    edges: restEdges,
  };
}

/**
 * @brief Removes multiple nodes and all incident edges from the workflow.
 *
 * If no node identifiers are provided, the original workflow is returned unchanged.
 *
 * @param activeWorkflow Workflow to update.
 * @param nodeIds Identifiers of nodes to remove.
 * @return Updated workflow without the selected nodes and their related edges.
 */
export function removeNodes(
  activeWorkflow: Workflow,
  nodeIds: string[]
): Workflow {
  if (nodeIds.length === 0) {
    return activeWorkflow;
  }

  const idsToRemove = new Set(nodeIds);

  const restNodes: typeof activeWorkflow.nodes = {};
  for (const [nodeId, node] of Object.entries(activeWorkflow.nodes)) {
    if (!idsToRemove.has(nodeId)) {
      restNodes[nodeId] = node;
    }
  }

  const restEdges: typeof activeWorkflow.edges = {};
  for (const [edgeId, edge] of Object.entries(activeWorkflow.edges)) {
    if (idsToRemove.has(edge.source)) continue;
    if (idsToRemove.has(edge.target)) continue;
    restEdges[edgeId] = edge;
  }

  return {
    ...activeWorkflow,
    nodes: restNodes,
    edges: restEdges,
  };
}