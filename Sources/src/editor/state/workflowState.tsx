/**
 * @file workflowState.tsx
 * @brief Global state management for the workflow editor.
 * @author Silvia Šlachtovská
 *
 * This file contains the React context and provider used to manage
 * the workflow graph. It exposes the workflow state and dispatch
 * function across the application.
 */

import React, { 
  createContext, 
  useContext, 
  useMemo, 
  useReducer,
  useCallback } from 'react';
import { createInitialWorkflow } from './workflowUtils';
import { reducer, type Action, type State } from './workflowReducer';

import { useEffect } from 'react';
import { createWorkflowTestApi } from '../testing/testApi';

type HistoryAction = Action | { type: 'history/markSaved' };

/**
 * @brief State wrapper used for undo/redo history.
 */
type HistoryState = {
  past: State[];
  present: State;
  future: State[];
  savedPresent: State; // for NEW
};

/**
 * @brief Context value exposed to components.
 *
 * Components receive the current editor state (`state`),
 * the dispatch function, and flags that indicate whether
 * undo/redo is currently possible.
 */
const Ctx = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  markSaved: () => void;
} | null>(null);

/**
 * @brief Create the initial editor state.
 */
function createInitialState(): State {
  return {
    workflow: createInitialWorkflow(),
    activePath: [],
    selectedNodeIds: [],
    selectedEdgeId: null,
  };
}

/**
 * @brief Returns true if an action should create a history snapshot.
 *
 * Selection-only and navigation actions are not recorded,
 * because undo/redo should focus on real workflow edits.
 */
function shouldRecordInHistory(action: Action): boolean {
  switch (action.type) {
    case 'selection/setSingleNode':
    case 'selection/toggleNode':
    case 'selection/setNodes':
    case 'selection/clearNodes':
    case 'selection/setEdge':
    case 'navigation/openSubworkflow':
    case 'navigation/goBack':
    case 'navigation/goToRoot':
    case 'history/undo':
    case 'history/redo':
      return false;

    default:
      return true;
  }
}

function areStatesEqualForDirtyCheck(a: State, b: State): boolean {
  return JSON.stringify(a.workflow) === JSON.stringify(b.workflow);
}

/**
 * @brief Reducer wrapper adding undo/redo support around the editor reducer.
 */
function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'history/undo': {
      if (state.past.length === 0) return state;

      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);

      return {
        ...state,
        past: newPast,
        present: previous,
        future: [state.present, ...state.future],
      };
    }

    case 'history/redo': {
      if (state.future.length === 0) return state;

      const next = state.future[0];
      const newFuture = state.future.slice(1);

      return {
        ...state,
        past: [...state.past, state.present],
        present: next,
        future: newFuture,
      };
    }

    case 'history/markSaved': {
      return {
        ...state,
        savedPresent: state.present,
      };
    }

    default: {
      const newPresent = reducer(state.present, action);

      if (newPresent === state.present) {
        return state;
      }

      if (!shouldRecordInHistory(action)) {
        return {
          ...state,
          present: newPresent,
        };
      }

      const MAX_HISTORY = 100;
      const newPast = [...state.past, state.present];
      const trimmedPast =
        newPast.length > MAX_HISTORY
          ? newPast.slice(newPast.length - MAX_HISTORY)
          : newPast;

      return {
        ...state,
        past: trimmedPast,
        present: newPresent,
        future: [],
      };
    }
  }
}

/**
 * @brief Context provider for the workflow editor.
 *
 * Wraps the application and provides global access
 * to workflow state and reducer actions.
 */
export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const initial = createInitialState();

  const [historyState, rawDispatch] = useReducer(historyReducer, {
    past: [],
    present: initial,
    future: [],
    savedPresent: initial,
  });

  const markSaved = useCallback(() => {
    rawDispatch({ type: 'history/markSaved' });
  }, []);

  const value = useMemo(
    () => ({
      state: historyState.present,
      dispatch: rawDispatch as React.Dispatch<Action>,
      canUndo: historyState.past.length > 0,
      canRedo: historyState.future.length > 0,
      isDirty: !areStatesEqualForDirtyCheck(
        historyState.present,
        historyState.savedPresent
      ),
      markSaved,
    }),
    [historyState, markSaved]
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (typeof window === 'undefined') return;

    window.__workflowTestApi = createWorkflowTestApi({
      getState: () => historyState.present,
      dispatch: rawDispatch as React.Dispatch<Action>,
    });

    return () => {
      delete window.__workflowTestApi;
    };
  }, [historyState, rawDispatch]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * @brief Custom hook for accessing workflow state.
 *
 * This is the main way components interact with the
 * workflow store.
 *
 * @throws Error if used outside of WorkflowProvider.
 */
export function useWorkflowState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkflowState must be used inside WorkflowProvider');
  return ctx;
}