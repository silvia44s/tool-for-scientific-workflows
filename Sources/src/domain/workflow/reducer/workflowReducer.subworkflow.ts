/**
 * @file workflowReducer.subworkflow.ts
 * @brief Handles grouping and ungrouping of subworkflow nodes.
 * @author Silvia Šlachtovská
 *
 * This file contains reducer logic for creating a subworkflow from the current
 * selection and for expanding an existing subworkflow node back into its original nodes.
 * The operations are applied within the currently active workflow.
 */

import type { Action } from '../model/actions';
import type { State } from './workflowReducer';
import { createSubworkflowFromSelection, ungroupSubworkflowNode } from '../operations/subworkflow';
import { getActiveWorkflow } from '../operations/workflowTree';
import { replaceActiveWorkflow } from './workflowReducer.helpers';

/**
 * @brief Applies subworkflow-related actions to the workflow reducer state.
 *
 * Supports grouping selected task nodes into a new subworkflow and ungrouping
 * a selected subworkflow node back into its contained nodes. Selection is updated
 * to reflect the newly created or restored nodes.
 *
 * @param state Current reducer state.
 * @param action Action to apply.
 * @return Updated state if the action is handled, otherwise null.
 */
export function handleSubworkflowAction(state: State, action: Action): State | null {
  switch (action.type) {
    case 'workflow/groupSelection': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const selectedIds = state.selectedNodeIds;

      if (selectedIds.length < 2) {
        return state;
      }

      const selectedNodes = selectedIds
        .map((id) => activeWorkflow.nodes[id])
        .filter(Boolean);

      const taskOnly = selectedNodes.every((n) => n.type === 'task');
      if (!taskOnly) {
        return state;
      }

      const result = createSubworkflowFromSelection(activeWorkflow, selectedIds);

      if (!result.createdNodeId) {
        return state;
      }

      return {
        ...replaceActiveWorkflow(state, result.workflow),
        selectedNodeIds: [result.createdNodeId],
        selectedEdgeId: null,
      };
    }

    case 'workflow/ungroupSelectedSubworkflow': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);

      if (state.selectedNodeIds.length !== 1) {
        return state;
      }

      const selectedNodeId = state.selectedNodeIds[0];
      const selectedNode = activeWorkflow.nodes[selectedNodeId];

      if (!selectedNode || selectedNode.type !== 'subworkflow') {
        return state;
      }

      const result = ungroupSubworkflowNode(activeWorkflow, selectedNodeId);

      if (result.restoredNodeIds.length === 0) {
        return state;
      }

      return {
        ...replaceActiveWorkflow(state, result.workflow),
        selectedNodeIds: result.restoredNodeIds,
        selectedEdgeId: null,
      };
    }

    default:
      return null;
  }
}