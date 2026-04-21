/**
 * @file workflowReducer.helpers.ts
 * @brief Shared helper functions used by workflow reducer modules.
 * @author Silvia Šlachtovská
 *
 * This file contains reusable utilities for updating the currently active workflow
 * and task nodes within reducer handlers. The helpers centralize navigation-aware
 * workflow replacement and reduce duplication across reducer submodules.
 */

import type { Workflow, TaskNode } from '../model/model';
import type { State } from './workflowReducer';
import { getActiveWorkflow, updateWorkflowAtPath } from '../operations/workflowTree';

/**
 * @brief Replaces the currently active workflow inside the reducer state.
 *
 * The replacement respects the current navigation path, which means the update
 * is applied either to the root workflow or to a nested subworkflow.
 *
 * @param state Current reducer state.
 * @param activeWorkflow New active workflow instance.
 * @return Updated reducer state with the replaced workflow subtree.
 */
export function replaceActiveWorkflow(state: State, activeWorkflow: Workflow): State {
  return {
    ...state,
    workflow: updateWorkflowAtPath(
      state.workflow,
      state.activePath,
      activeWorkflow
    ),
  };
}

/**
 * @brief Updates the currently active workflow using a callback function.
 *
 * The active workflow is first resolved from the current navigation path,
 * then passed to the updater function, and finally written back into the root state.
 * If the updater returns the same workflow instance, the original state is preserved.
 *
 * @param state Current reducer state.
 * @param updater Function producing an updated active workflow.
 * @return Updated reducer state.
 */
export function updateActiveWorkflow(
  state: State,
  updater: (activeWorkflow: Workflow) => Workflow
): State {
  const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
  const updatedActiveWorkflow = updater(activeWorkflow);

  if (updatedActiveWorkflow === activeWorkflow) {
    return state;
  }

  return replaceActiveWorkflow(state, updatedActiveWorkflow);
}

/**
 * @brief Updates one task node inside the currently active workflow.
 *
 * The helper resolves the task node by identifier, verifies its type,
 * applies the provided updater callback, and writes the updated node
 * back into the active workflow. The updater may also replace the workflow edges.
 *
 * @param state Current reducer state.
 * @param nodeId Identifier of the task node to update.
 * @param updater Function producing an updated task node and optionally updated edges.
 * @return Updated reducer state, or the original state if the node does not exist
 *         or the updater returns null.
 */
export function updateTaskNode(
  state: State,
  nodeId: string,
  updater: (
    node: TaskNode,
    activeWorkflow: Workflow
  ) => {
    node: TaskNode;
    edges?: Workflow['edges'];
  } | null
): State {
  const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
  const existing = activeWorkflow.nodes[nodeId];

  if (!existing || existing.type !== 'task') {
    return state;
  }

  const result = updater(existing, activeWorkflow);
  if (!result) {
    return state;
  }

  const nodes = {
    ...activeWorkflow.nodes,
    [nodeId]: result.node,
  };

  const updatedActiveWorkflow: Workflow = {
    ...activeWorkflow,
    nodes,
    edges: result.edges ?? activeWorkflow.edges,
  };

  return replaceActiveWorkflow(state, updatedActiveWorkflow);
}