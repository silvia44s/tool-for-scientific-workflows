/**
 * @file workflowImport.ts
 * @brief Provides parsing and user-friendly error handling for workflow import.
 *
 * This file is responsible for converting imported JSON text into a validated
 * workflow object using the workflow schema. It also translates parser and
 * validation failures into readable error messages suitable for the UI.
 */

import { ZodError } from 'zod';
import type { Workflow } from '../domain/workflow/model/model';
import { WorkflowSchema } from './workflowSchema';

/**
 * @brief Parses and validates an imported workflow JSON document.
 *
 * The function first parses the raw JSON text and then validates the result
 * against the workflow schema, including semantic checks.
 *
 * @param jsonText Raw JSON text loaded from an imported file.
 * @return Validated workflow object.
 * @throws SyntaxError If the input is not valid JSON.
 * @throws ZodError If the parsed JSON does not match the required workflow format.
 */
export function parseWorkflowImport(jsonText: string): Workflow {
  const parsed: unknown = JSON.parse(jsonText);
  return WorkflowSchema.parse(parsed) as Workflow;
}

/**
 * @brief Converts workflow import errors into user-friendly messages.
 *
 * Syntax errors are reported as invalid JSON, schema validation errors are mapped
 * to the first reported issue including its path, and all other failures are
 * returned as a generic import error.
 *
 * @param error Error thrown during workflow import.
 * @return Human-readable error message suitable for displaying in the UI.
 */
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