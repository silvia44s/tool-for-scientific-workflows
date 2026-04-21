/**
 * @file WorkflowProvider.tsx
 * @brief Provides the global workflow editor state through React context, including history-aware state management,
 * undo/redo metadata, dirty-state tracking, and development test API integration.
 * @author Silvia Šlachtovská
 */

import React, { useMemo, useReducer, useCallback } from 'react';
import type { Action } from '../../../domain/workflow';
import {
  historyReducer,
  areStatesEqualForDirtyCheck,
} from '../../../domain/workflow';
import { WorkflowContext } from './workflowContext';
import { createInitialState } from './workflowInitialState';
import { useWorkflowDevTools } from './useWorkflowDevTools';


/**
 * @brief Wraps the application subtree with workflow editor state and actions.
 *
 * Initializes the workflow editor state, connects it to the history-aware reducer,
 * computes derived flags such as undo/redo availability and dirty-state status,
 * and exposes the resulting API through {@link WorkflowContext}.
 *
 * In development mode, this provider also registers the workflow test API
 * for debugging and automated testing.
 *
 * @param children React subtree that should have access to the workflow context.
 * @return JSX element providing workflow editor state to all nested components.
 */
export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const initialState = useMemo(() => createInitialState(), []);

  const [historyState, rawDispatch] = useReducer(historyReducer, {
    past: [],
    present: initialState,
    future: [],
    savedPresent: initialState,
  });


  /**
   * @brief Dispatches a workflow domain action to the history-aware reducer.
   *
   * This callback exposes only regular workflow actions to context consumers,
   * while internal history actions remain handled inside the provider.
   *
   * @param action Workflow action to dispatch.
   */
  const dispatch = useCallback(
    (action: Action) => {
      rawDispatch(action);
    },
    [rawDispatch]
  );

  /**
   * @brief Marks the current workflow state as saved.
   *
   * This resets the dirty-check baseline used to determine whether
   * the current editor state differs from the last saved version.
   */
  const markSaved = useCallback(() => {
    rawDispatch({ type: 'history/markSaved' });
  }, [rawDispatch]);

  useWorkflowDevTools({
    state: historyState.present,
    dispatch: rawDispatch,
  });

  const value = useMemo(
    () => ({
      state: historyState.present,
      dispatch,
      canUndo: historyState.past.length > 0,
      canRedo: historyState.future.length > 0,
      isDirty: !areStatesEqualForDirtyCheck(
        historyState.present,
        historyState.savedPresent
      ),
      markSaved,
    }),
    [historyState, dispatch, markSaved]
  );

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}