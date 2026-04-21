/**
 * @file canvasUtils.ts
 * @brief Utility functions used by the workflow canvas component.
 * @author Silvia Šlachtovská
 */

import type { Edge } from 'reactflow';
import type { WorkflowNode, PortDataType } from '../../../domain/workflow/model/model';

/**
 * @brief Finds the data type of a specific input or output port.
 *
 * @param nodeId Identifier of the node containing the port.
 * @param handleId Identifier of the port handle.
 * @param direction Direction of the port.
 * @param nodes Map of workflow nodes.
 * @return Port data type if found, otherwise null.
 */
export function findPortType(
  nodeId: string,
  handleId: string,
  direction: 'input' | 'output',
  nodes: Record<string, WorkflowNode>
): PortDataType | null {
  const node = nodes[nodeId];
  if (!node) return null;

  const io = node.type === 'task' ? node.task.io : node.subworkflow.io;
  const ports = direction === 'input' ? io.inputs : io.outputs;
  const port = ports.find((item) => item.id === handleId);

  return port?.dataType ?? null;
}

/**
 * @brief Checks whether two port data types are compatible.
 *
 * The current implementation allows only strict equality.
 *
 * @param sourceType Source port type.
 * @param targetType Target port type.
 * @return True if the types are compatible.
 */
export function isCompatible(
  sourceType: PortDataType,
  targetType: PortDataType
): boolean {
  return sourceType === targetType;
}

/**
 * @brief Detects whether adding an edge would create a cycle in the workflow graph.
 *
 * Uses depth-first traversal starting from the target node.
 *
 * @param source Source node identifier.
 * @param target Target node identifier.
 * @param edges Existing workflow edges.
 * @return True if the new connection would create a cycle.
 */
export function wouldCreateCycle(
  source: string,
  target: string,
  edges: Edge[]
): boolean {
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }

    adjacency.get(edge.source)!.push(edge.target);
  }

  const stack = [target];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const nodeId = stack.pop()!;
    if (nodeId === source) return true;
    if (visited.has(nodeId)) continue;

    visited.add(nodeId);

    const next = adjacency.get(nodeId) ?? [];
    for (const nextNode of next) {
      stack.push(nextNode);
    }
  }

  return false;
}