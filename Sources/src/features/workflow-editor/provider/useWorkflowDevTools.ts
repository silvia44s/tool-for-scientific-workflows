/**
 * @file useWorkflowDevTools.ts
 * @brief Registers development-only workflow testing helpers on the global window object.
 * @author Silvia Šlachtovská
 */

import { useEffect } from 'react';
import type React from 'react';
import type { Action, State } from '../../../domain/workflow';
import { createWorkflowTestApi } from '../testing/testApi';

/**
 * @brief Parameters required to expose the workflow test API in development mode.
 */
type UseWorkflowDevToolsParams = {
  /** Current workflow editor state. */
  state: State;

  /** Dispatch function used to control the workflow reducer during tests. */
  dispatch: React.Dispatch<Action>;
};

/**
 * @brief Attaches workflow testing helpers to the global window object in development mode.
 *
 * This hook is intended only for debugging and automated testing.
 * In development builds, it exposes a test API under {@code window.__workflowTestApi}
 * and removes it automatically when the component is unmounted or dependencies change.
 *
 * @param state Current workflow editor state.
 * @param dispatch Dispatch function used by the workflow reducer.
 */
export function useWorkflowDevTools({
  state,
  dispatch,
}: UseWorkflowDevToolsParams) {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (typeof window === 'undefined') return;

    window.__workflowTestApi = createWorkflowTestApi({
      getState: () => state,
      dispatch,
    });

    return () => {
      delete window.__workflowTestApi;
    };
  }, [state, dispatch]);
}