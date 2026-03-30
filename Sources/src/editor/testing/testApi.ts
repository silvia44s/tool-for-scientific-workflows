/**
 * @file testApi.ts
 * @brief Internal testing API for automated performance benchmarking.
 * @author Silvia Šlachtovská
 *
 */

import type { TaskNodePreset, WorkflowNode } from '../state/model';
import { createTaskNodeFromPreset } from '../state/nodePresets';
import { createInitialWorkflow } from '../state/workflowUtils';
import type { Action, State } from '../state/workflowReducer';

type Dispatch = React.Dispatch<Action>;

export type WorkflowTestApi = {
  resetWorkflow: () => void;
  getNodeCount: () => number;
  insertPresetCopies: (preset: TaskNodePreset, count: number) => number;
  selectFirstNode: () => boolean;
  deleteSelection: () => boolean;
  undo: () => boolean;
};

declare global {
  interface Window {
    __workflowTestApi?: WorkflowTestApi;
  }
}

export function createWorkflowTestApi(params: {
  getState: () => State;
  dispatch: Dispatch;
}): WorkflowTestApi {
  const { getState, dispatch } = params;

  function createPresetNodesInGrid(
    preset: TaskNodePreset,
    count: number
  ): WorkflowNode[] {
    const startX = 140;
    const startY = 140;
    const colWidth = 220;
    const rowHeight = 140;
    const cols = 3;

    return Array.from({ length: count }, (_, i) => {
      const position = {
        x: startX + (i % cols) * colWidth,
        y: startY + Math.floor(i / cols) * rowHeight,
      };

      return createTaskNodeFromPreset(preset, position);
    });
  }

  return {
    resetWorkflow() {
      dispatch({
        type: 'workflow/replace',
        workflow: createInitialWorkflow(),
      });
    },

    getNodeCount() {
      return Object.keys(getState().workflow.nodes).length;
    },

    insertPresetCopies(preset, count) {
      const nodes = createPresetNodesInGrid(preset, count);

      dispatch({
        type: 'node/addMany',
        nodes,
      });

      return nodes.length;
    },

    selectFirstNode() {
      const firstNode = Object.values(getState().workflow.nodes)[0];
      if (!firstNode) return false;

      dispatch({
        type: 'selection/setSingleNode',
        nodeId: firstNode.id,
      });

      return true;
    },

    deleteSelection() {
      const state = getState();

      if (state.selectedEdgeId) {
        dispatch({ type: 'edge/remove', edgeId: state.selectedEdgeId });
        return true;
      }

      if (state.selectedNodeIds.length > 0) {
        dispatch({ type: 'node/removeMany', nodeIds: state.selectedNodeIds });
        return true;
      }

      return false;
    },

    undo() {
      dispatch({ type: 'history/undo' });
      return true;
    },
  };
}