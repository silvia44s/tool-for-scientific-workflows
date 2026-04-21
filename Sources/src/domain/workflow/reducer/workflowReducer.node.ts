/**
 * @file workflowReducer.node.ts
 * @brief Handles node-related state transitions in the workflow reducer.
 * @author Silvia Šlachtovská
 *
 * This file contains reducer logic for adding, updating, moving,
 * and removing workflow nodes in the currently active workflow.
 * It also updates selection state after node operations when needed.
 */

import type { Action } from '../model/actions';
import type { State } from './workflowReducer';
import { updateActiveWorkflow } from './workflowReducer.helpers';
import {
  addNode,
  addNodes,
  createDefaultTaskNode,
  removeNode,
  removeNodes,
  setNodePosition,
  updateNode,
} from '../operations/nodeOperations';

/**
 * @brief Applies node-related actions to the workflow reducer state.
 *
 * Supports node creation, updates, position changes, removal,
 * preset insertion, and batch addition or deletion of nodes.
 * Selection state is updated after operations that affect currently
 * selected nodes or introduce new ones.
 *
 * @param state Current reducer state.
 * @param action Action to apply.
 * @return Updated state if the action is handled, otherwise null.
 */
export function handleNodeAction(state: State, action: Action): State | null {
  switch (action.type) {
    case 'node/addTask': {
      const node = createDefaultTaskNode(action.position);

      const nextState = updateActiveWorkflow(state, (activeWorkflow) =>
        addNode(activeWorkflow, node)
      );

      return {
        ...nextState,
        selectedNodeIds: [node.id],
        selectedEdgeId: null,
      };
    }

    case 'node/update':
      return updateActiveWorkflow(state, (activeWorkflow) =>
        updateNode(activeWorkflow, action.nodeId, action.patch)
      );

    case 'node/setPosition':
      return updateActiveWorkflow(state, (activeWorkflow) =>
        setNodePosition(activeWorkflow, action.nodeId, action.position)
      );

    case 'node/remove': {
      const nextState = updateActiveWorkflow(state, (activeWorkflow) =>
        removeNode(activeWorkflow, action.nodeId)
      );

      return {
        ...nextState,
        selectedNodeIds: state.selectedNodeIds.filter((id) => id !== action.nodeId),
        selectedEdgeId: null,
      };
    }

    case 'node/removeMany': {
      if (action.nodeIds.length === 0) {
        return state;
      }

      const idsToRemove = new Set(action.nodeIds);

      const nextState = updateActiveWorkflow(state, (activeWorkflow) =>
        removeNodes(activeWorkflow, action.nodeIds)
      );

      return {
        ...nextState,
        selectedNodeIds: state.selectedNodeIds.filter((id) => !idsToRemove.has(id)),
        selectedEdgeId: null,
      };
    }

    case 'node/addPresetNode':
      return updateActiveWorkflow(state, (activeWorkflow) =>
        addNode(activeWorkflow, action.node)
      );

    case 'node/addMany': {
      if (action.nodes.length === 0) return state;

      const nextState = updateActiveWorkflow(state, (activeWorkflow) =>
        addNodes(activeWorkflow, action.nodes)
      );

      return {
        ...nextState,
        selectedNodeIds: action.nodes.map((n) => n.id),
        selectedEdgeId: null,
      };
    }

    default:
      return null;
  }
}