/**
 * @file global.d.ts
 * @brief Type definitions for global testing API.
 * @author Silvia Šlachtovská
 *
 */
export {};

declare global {
  interface Window {
    __workflowTestApi?: {
      resetWorkflow: () => void;
      getNodeCount: () => number;
      insertPresetCopies: (preset: unknown, count: number) => number;
      selectFirstNode: () => boolean;
      deleteSelection: () => boolean;
      undo: () => boolean;
    };
  }
}