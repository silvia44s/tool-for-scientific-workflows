/**
 * @file workflowReducer.selection.ts
 * @brief Handles node and edge selection state transitions.
 * @author Silvia Šlachtovská
 *
 * This file contains reducer logic for managing current selection
 * in the workflow editor, including single-node selection,
 * multi-selection of nodes, clearing selection, and edge selection.
 */

import type { Action } from '../model/actions';
import type { State } from './workflowReducer';

/**
 * @brief Applies selection-related actions to the workflow reducer state.
 *
 * Supports setting and toggling selected nodes, replacing the current
 * node selection, clearing selection, and selecting a single edge.
 * Node and edge selection are mutually exclusive.
 *
 * @param state Current reducer state.
 * @param action Action to apply.
 * @return Updated state if the action is handled, otherwise null.
 */
export function handleSelectionAction(state: State, action: Action): State | null {
  switch (action.type) {
    case 'selection/setSingleNode':
      return {
        ...state,
        selectedNodeIds: action.nodeId ? [action.nodeId] : [],
        selectedEdgeId: null,
      };

    case 'selection/toggleNode': {
      const exists = state.selectedNodeIds.includes(action.nodeId);

      return {
        ...state,
        selectedNodeIds: exists
          ? state.selectedNodeIds.filter((id) => id !== action.nodeId)
          : [...state.selectedNodeIds, action.nodeId],
        selectedEdgeId: null,
      };
    }

    case 'selection/setNodes':
      return {
        ...state,
        selectedNodeIds: action.nodeIds,
        selectedEdgeId: null,
      };

    case 'selection/clearNodes':
      return {
        ...state,
        selectedNodeIds: [],
      };

    case 'selection/setEdge':
      return {
        ...state,
        selectedEdgeId: action.edgeId,
        selectedNodeIds: [],
      };

    default:
      return null;
  }
}