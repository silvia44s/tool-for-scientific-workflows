/**
 * @file workflowState.tsx
 * @brief Global state management for the workflow editor.
 * @author Silvia Šlachtovská
 *
 * This file contains the React context and provider used to manage
 * the workflow graph. It exposes the workflow state and dispatch
 * function across the application.
 */

import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { createInitialWorkflow } from './workflowUtils';
import { reducer, type Action, type State } from './workflowReducer';

/**
 * @brief React context used to expose workflow state.
 *
 * Components can read and modify the workflow using
 * the provided `state` and `dispatch`.
 */
const Ctx = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

/**
 * @brief Context provider for the workflow editor.
 *
 * Wraps the application and provides global access
 * to workflow state and reducer actions.
 */
export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    workflow: createInitialWorkflow(),
    activePath: [],
    selectedNodeIds: [],
    selectedEdgeId: null,
  });

  const value = useMemo(() => ({ state, dispatch }), [state]);
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