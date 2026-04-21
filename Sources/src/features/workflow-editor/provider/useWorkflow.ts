/**
 * @file useWorkflow.ts
 * @brief Provides a safe React hook for accessing the workflow editor context.
 * @author Silvia Šlachtovská
 */

import { useContext } from 'react';
import { WorkflowContext } from './workflowContext';

/**
 * @brief Returns the workflow editor context value.
 *
 * This hook provides access to the current workflow editor state,
 * workflow action dispatch, derived history flags, and save marker helper.
 *
 * It must be used only inside a component subtree wrapped by
 * {@link WorkflowProvider}.
 *
 * @throws Error If used outside {@link WorkflowProvider}.
 * @return Workflow editor context value.
 */
export function useWorkflow() {
  const context = useContext(WorkflowContext);

  if (!context) {
    throw new Error('useWorkflow must be used inside WorkflowProvider');
  }

  return context;
}