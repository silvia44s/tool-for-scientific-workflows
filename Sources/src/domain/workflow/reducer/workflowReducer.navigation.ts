/**
 * @file workflowReducer.navigation.ts
 * @brief Handles navigation state transitions in nested workflows.
 * @author Silvia Šlachtovská
 *
 * This file contains reducer logic for entering subworkflows,
 * navigating back to parent workflows, and returning to the root workflow.
 * Navigation changes also clear the current node and edge selection.
 */

import type { Action } from '../model/actions';
import type { State } from './workflowReducer';
import { getActiveWorkflow } from '../operations/workflowTree';

/**
 * @brief Applies navigation-related actions to the workflow reducer state.
 *
 * Supports opening a subworkflow, returning to the parent workflow,
 * and navigating back to the root. If the requested subworkflow node
 * does not exist or is not of the correct type, the state is preserved.
 *
 * @param state Current reducer state.
 * @param action Action to apply.
 * @return Updated state if the action is handled, otherwise null.
 */
export function handleNavigationAction(state: State, action: Action): State | null {
  switch (action.type) {
    case 'navigation/openSubworkflow': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];

      if (!node || node.type !== 'subworkflow') {
        return state;
      }

      return {
        ...state,
        activePath: [...state.activePath, action.nodeId],
        selectedNodeIds: [],
        selectedEdgeId: null,
      };
    }

    case 'navigation/goBack':
      if (state.activePath.length === 0) return state;

      return {
        ...state,
        activePath: state.activePath.slice(0, -1),
        selectedNodeIds: [],
        selectedEdgeId: null,
      };

    case 'navigation/goToRoot':
      return {
        ...state,
        activePath: [],
        selectedNodeIds: [],
        selectedEdgeId: null,
      };

    default:
      return null;
  }
}