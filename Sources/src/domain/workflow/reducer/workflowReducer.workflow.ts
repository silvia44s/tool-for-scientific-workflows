/**
 * @file workflowReducer.workflow.ts
 * @brief Handles workflow-level state transitions in the reducer.
 * @author Silvia Šlachtovská
 *
 * This file contains reducer logic for updating workflow metadata,
 * replacing the current workflow document, and changing execution settings
 * such as output location and backend.
 */

import type { Action } from '../model/actions';
import type { State } from './workflowReducer';

/**
 * @brief Applies workflow-level actions to the reducer state.
 *
 * Supports updates of workflow name, results root, execution backend,
 * and complete replacement of the workflow document. Replacing the workflow
 * also resets navigation and selection state.
 *
 * @param state Current reducer state.
 * @param action Action to apply.
 * @return Updated state if the action is handled, otherwise null.
 */
export function handleWorkflowAction(state: State, action: Action): State | null {
  switch (action.type) {
    case 'workflow/setName':
      return {
        ...state,
        workflow: {
          ...state.workflow,
          name: action.name,
        },
      };

    case 'workflow/setResultsRoot':
      return {
        ...state,
        workflow: {
          ...state.workflow,
          run: {
            ...(state.workflow.run ?? {}),
            resultsRoot: action.resultsRoot,
            backend: state.workflow.run?.backend || 'local',
          },
        },
      };

    case 'workflow/setBackend':
      return {
        ...state,
        workflow: {
          ...state.workflow,
          run: {
            ...state.workflow.run,
            backend: action.backend,
          },
        },
      };

    case 'workflow/replace':
      return {
        ...state,
        workflow: action.workflow,
        activePath: [],
        selectedNodeIds: [],
        selectedEdgeId: null,
      };

    default:
      return null;
  }
}