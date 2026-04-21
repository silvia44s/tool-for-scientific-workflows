/**
 * @file workflowReducer.ts
 * @brief Root reducer function for managing workflow editor state.
 * @author Silvia Šlachtovská
 *
 * This file defines the main reducer state structure and delegates incoming actions
 * to specialized reducer modules responsible for workflow metadata, selection,
 * navigation, nodes, edges, tasks, and subworkflow operations.
 */

import type { Action } from '../model/actions';
import type { Workflow } from '../model/model';
import { handleWorkflowAction } from './workflowReducer.workflow';
import { handleSelectionAction } from './workflowReducer.selection';
import { handleNavigationAction } from './workflowReducer.navigation';
import { handleNodeAction } from './workflowReducer.node';
import { handleEdgeAction } from './workflowReducer.edge';
import { handleTaskAction } from './workflowReducer.task';
import { handleSubworkflowAction } from './workflowReducer.subworkflow';

/**
 * @brief Complete state managed by the workflow reducer.
 *
 * Stores the current workflow document, navigation path inside nested workflows,
 * and current node or edge selection in the editor.
 */
export type State = {
  workflow: Workflow;
  activePath: string[];
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
};

/**
 * @brief Main workflow reducer.
 *
 * Dispatches actions to specialized reducer handlers in a fixed order.
 * The first handler that processes the action returns the updated state.
 * If no handler processes the action, the original state is preserved.
 *
 * @param state Current reducer state.
 * @param action Action to apply.
 * @return Updated reducer state.
 */
export function reducer(state: State, action: Action): State {
  return (
    handleWorkflowAction(state, action) ??
    handleSelectionAction(state, action) ??
    handleNavigationAction(state, action) ??
    handleNodeAction(state, action) ??
    handleEdgeAction(state, action) ??
    handleTaskAction(state, action) ??
    handleSubworkflowAction(state, action) ??
    state
  );
}