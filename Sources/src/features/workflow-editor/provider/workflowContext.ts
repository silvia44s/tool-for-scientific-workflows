/**
 * @file workflowContext.ts
 * @brief Defines the React context and public context value type for accessing workflow editor state and actions.
 * @author Silvia Šlachtovská
 */

import { createContext } from 'react';
import type React from 'react';
import type { Action } from '../../../domain/workflow/model/actions';
import type { State } from '../../../domain/workflow/reducer/workflowReducer';

/**
 * @brief Public API exposed through the workflow editor React context.
 *
 * Contains the current workflow editor state, dispatch function for workflow actions,
 * derived history and dirty-state flags, and a helper for marking the current state as saved.
 */
export type WorkflowContextValue = {
  /** Current workflow editor state. */
  state: State;

  /** Dispatch function for workflow domain actions. */
  dispatch: React.Dispatch<Action>;

  /** Indicates whether an undo operation is currently available. */
  canUndo: boolean;

  /** Indicates whether a redo operation is currently available. */
  canRedo: boolean;

  /** Indicates whether the current state differs from the last saved state. */
  isDirty: boolean;

  /** Marks the current state as the saved baseline for dirty-state tracking. */
  markSaved: () => void;
};

/**
 * @brief React context used to share workflow editor state and actions across the component tree.
 *
 * The context is initialized with {@code null} and must be consumed only inside
 * {@link WorkflowProvider}.
 */
export const WorkflowContext = createContext<WorkflowContextValue | null>(null);