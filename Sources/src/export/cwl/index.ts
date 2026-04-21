/**
 * @file index.ts
 * @brief Public API for the CWL export module.
 *
 * This file re-exports the main export function and related types used
 * for generating CWL bundles from workflow definitions.
 * It serves as a single entry point for other parts of the application.
 */

export { exportWorkflowAsCwl } from './bundleExporter';

export type {
  CwlBundle,
  CwlFile,
  ExportDiagnostic,
  ExportResult,
} from './types';