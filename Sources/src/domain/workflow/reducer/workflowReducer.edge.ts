/**
 * @file workflowReducer.edge.ts
 * @brief Handles edge-related state transitions in the workflow reducer.
 * @author Silvia Šlachtovská
 *
 * This file contains reducer logic for adding and removing workflow edges.
 * The operations are applied to the currently active workflow, including
 * nested workflows when navigation is inside a subworkflow.
 */

import type { Action } from '../model/actions';
import type { State } from './workflowReducer';
import { updateActiveWorkflow } from './workflowReducer.helpers';
import { addEdge, removeEdge } from '../operations/edgeOperations';

/**
 * @brief Applies edge-related actions to the workflow state.
 *
 * Supports creation and removal of edges in the currently active workflow.
 * When a removed edge is currently selected, the edge selection is cleared.
 *
 * @param state Current reducer state.
 * @param action Action to apply.
 * @return Updated state if the action is handled, otherwise null.
 */
export function handleEdgeAction(state: State, action: Action): State | null {
  switch (action.type) {
    case 'edge/add':
      return updateActiveWorkflow(state, (activeWorkflow) =>
        addEdge(activeWorkflow, action.edge)
      );

    case 'edge/remove': {
      const nextState = updateActiveWorkflow(state, (activeWorkflow) =>
        removeEdge(activeWorkflow, action.edgeId)
      );

      return {
        ...nextState,
        selectedEdgeId:
          state.selectedEdgeId === action.edgeId ? null : state.selectedEdgeId,
      };
    }

    default:
      return null;
  }
}