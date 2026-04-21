/**
 * @file historyReducer.ts
 * @brief Provides undo/redo state management for the workflow editor reducer.
 * @author Silvia Šlachtovská
 *
 * This file wraps the main workflow reducer with history tracking.
 * It stores past, present, and future editor states, supports undo/redo,
 * and keeps track of the last saved state for dirty-check purposes.
 */

import type { Action, HistoryAction } from '../model/actions';
import type { State } from './workflowReducer';
import { reducer } from './workflowReducer';

/**
 * @brief State structure used by the history-aware workflow reducer.
 *
 * Stores previously applied states, the current state, states available for redo,
 * and the state that was last marked as saved.
 */
export type HistoryState = {
  past: State[];
  present: State;
  future: State[];
  savedPresent: State;
};

/**
 * @brief Determines whether an action should be recorded in history.
 *
 * UI-only actions such as selection changes and navigation are excluded
 * from undo/redo history, while structural workflow modifications are recorded.
 *
 * @param action Reducer action being processed.
 * @return True if the action should create a new history entry.
 */
export function shouldRecordInHistory(action: Action): boolean {
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

/**
 * @brief Compares two reducer states for dirty-check purposes.
 *
 * The comparison is based on the serialized workflow document only.
 * UI-specific state such as selection or navigation is intentionally ignored.
 *
 * @param a First state to compare.
 * @param b Second state to compare.
 * @return True if both states contain the same workflow content.
 */
export function areStatesEqualForDirtyCheck(a: State, b: State): boolean {
  return JSON.stringify(a.workflow) === JSON.stringify(b.workflow);
}

/**
 * @brief Applies one action to the history-aware reducer state.
 *
 * Handles undo, redo, save-marking, and delegates all other actions
 * to the main workflow reducer. Actions recorded in history create
 * a new past entry and clear the redo stack.
 *
 * @param state Current history reducer state.
 * @param action Action to apply.
 * @return Updated history reducer state.
 */
export function historyReducer(
  state: HistoryState,
  action: HistoryAction
): HistoryState {
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