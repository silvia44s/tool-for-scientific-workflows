/**
 * @file edgeOperations.ts
 * @brief Domain operations for creating and removing workflow edges.
 * @author Silvia Šlachtovská
 *
 * This file contains pure functions that modify workflow connections.
 * The operations are applied to the currently active workflow and preserve
 * immutability of the workflow document.
 */

import type { Workflow, WorkflowEdge } from '../model/model';
import { uid } from './workflowTree';

/**
 * @brief Adds a new edge to the workflow if an identical edge does not already exist.
 *
 * The function checks for an existing connection with the same source node,
 * target node, source handle, and target handle. If such an edge already exists,
 * the original workflow is returned unchanged.
 *
 * @param activeWorkflow Workflow to update.
 * @param edgeInput Edge definition without identifier.
 * @return Updated workflow containing the new edge, or the original workflow if the edge already exists.
 */
export function addEdge(
  activeWorkflow: Workflow,
  edgeInput: Omit<WorkflowEdge, 'id'>
): Workflow {
  const exists = Object.values(activeWorkflow.edges).some(
    (edge) =>
      edge.source === edgeInput.source &&
      edge.target === edgeInput.target &&
      edge.sourceHandle === edgeInput.sourceHandle &&
      edge.targetHandle === edgeInput.targetHandle
  );

  if (exists) {
    return activeWorkflow;
  }

  const id = uid('edge');
  const edge: WorkflowEdge = { id, ...edgeInput };

  return {
    ...activeWorkflow,
    edges: {
      ...activeWorkflow.edges,
      [id]: edge,
    },
  };
}

/**
 * @brief Removes an edge from the workflow by its identifier.
 *
 * @param activeWorkflow Workflow to update.
 * @param edgeId Identifier of the edge to remove.
 * @return Updated workflow without the removed edge.
 */
export function removeEdge(
  activeWorkflow: Workflow,
  edgeId: string
): Workflow {
  const { [edgeId]: _, ...restEdges } = activeWorkflow.edges;

  return {
    ...activeWorkflow,
    edges: restEdges,
  };
}