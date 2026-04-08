import { ZodError } from 'zod';
import type { Workflow } from '../editor/state/model';
import { WorkflowSchema } from './workflowSchema';

export function parseWorkflowImport(jsonText: string): Workflow {
  const parsed: unknown = JSON.parse(jsonText);
  return WorkflowSchema.parse(parsed) as Workflow;
}

export function getWorkflowImportErrorMessage(error: unknown): string {
  if (error instanceof SyntaxError) {
    return 'Invalid JSON file';
  }

  if (error instanceof ZodError) {
    const first = error.issues[0];
    if (!first) return 'Invalid workflow format';

    const path = first.path.length > 0 ? first.path.join('.') : 'workflow';
    return `Invalid workflow: ${path} - ${first.message}`;
  }

  return 'Failed to import workflow';
}