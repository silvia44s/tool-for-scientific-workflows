/**
 * @file topBarTypes.ts
 * @brief Defines helper types used by the workflow editor top bar.
 * @author Silvia Šlachtovská
 */

/**
 * @brief Information about a workflow execution error returned by the backend.
 */
export type RunErrorInfo = {
  title: string;
  message: string;
  stderr?: string;
  returncode?: number | null;
  runDir?: string | null;
};

/**
 * @brief Information about generated batch scripts waiting for optional submission.
 */
export type SubmitPromptInfo = {
  runDir: string;
  backend: 'slurm' | 'pbs';
};