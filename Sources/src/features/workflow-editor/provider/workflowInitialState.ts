/**
 * @file workflowInitialState.ts
 * @brief Creates the initial workflow editor state used when the editor is first opened.
 * @author Silvia Šlachtovská
 */
import type { State } from '../../../domain/workflow';
import { createInitialWorkflow } from '../../../domain/workflow/operations/workflowTree';

/**
 * @brief Creates the initial state of the workflow editor.
 *
 * The returned state contains a newly created empty workflow together with
 * default navigation and selection values.
 *
 * @return Initial workflow editor state.
 */
export function createInitialState(): State {
  return {
    workflow: createInitialWorkflow(),
    activePath: [],
    selectedNodeIds: [],
    selectedEdgeId: null,
  };
}