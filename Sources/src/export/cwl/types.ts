/**
 * @file types.ts
 * @brief Defines internal types used by the CWL export pipeline.
 *
 * This file contains helper data structures representing normalized CWL documents,
 * generated export bundles, diagnostics and intermediate mappings produced during export.
 */

import type { Workflow } from '../../domain/workflow/model/model';

/**
 * @brief Represents one generated file in the exported CWL bundle.
 */
export type CwlFile = {
  path: string;
  content: string;
};

/**
 * @brief Represents the complete exported CWL bundle.
 *
 * It contains the root file together with all additional generated files.
 */
export type CwlBundle = {
  rootPath: string;
  rootContent: string;
  files: CwlFile[];
};

/**
 * @brief Diagnostic message produced during export normalization or rendering.
 *
 * Diagnostics may report either errors or warnings and can optionally reference
 * a specific node, port or parameter.
 */
export type ExportDiagnostic = {
  level: 'error' | 'warning';
  message: string;
  nodeId?: string;
  portId?: string;
  paramId?: string;
};

/**
 * @brief Result of the top-level export operation.
 *
 * Successful export returns the generated bundle together with diagnostics.
 * Failed export returns diagnostics only.
 */
export type ExportResult =
  | {
      ok: true;
      bundle: CwlBundle;
      diagnostics: ExportDiagnostic[];
    }
  | {
      ok: false;
      diagnostics: ExportDiagnostic[];
    };

/**
 * @brief Normalized CWL input binding information.
 */
export type NormalizedInputBinding = {
  prefix?: string;
  position?: number;
};

/**
 * @brief Normalized representation of a CWL input definition.
 */
export type NormalizedCwlInput = {
  id: string;
  type: string;
  default?: string | number | boolean;
  doc?: string;
  inputBinding?: NormalizedInputBinding;
};

/**
 * @brief Normalized representation of a CWL output definition.
 */
export type NormalizedCwlOutput = {
  id: string;
  type: string;
  doc?: string;
  glob?: string;
};

/**
 * @brief Normalized representation of a CWL CommandLineTool document.
 */
export type NormalizedCommandLineTool = {
  kind: 'CommandLineTool';
  label: string;
  baseCommand: string;
  env: Record<string, string>;
  inputs: NormalizedCwlInput[];
  outputs: NormalizedCwlOutput[];
};

/**
 * @brief Normalized representation of a workflow-level input.
 */
export type NormalizedWorkflowInput = {
  id: string;
  type: string;
};

/**
 * @brief Normalized representation of a workflow step input binding.
 */
export type NormalizedWorkflowStepInput = {
  id: string;
  source: string;
};

/**
 * @brief Normalized representation of a workflow step.
 */
export type NormalizedWorkflowStep = {
  id: string;
  run: string;
  in: NormalizedWorkflowStepInput[];
  out: string[];
};

/**
 * @brief Normalized representation of a workflow-level output.
 */
export type NormalizedWorkflowOutput = {
  id: string;
  type: string;
  outputSource: string;
};

/**
 * @brief Normalized representation of a CWL Workflow document.
 */
export type NormalizedWorkflowDoc = {
  kind: 'Workflow';
  label: string;
  requirements: {
    subworkflowFeature: boolean;
  };
  inputs: NormalizedWorkflowInput[];
  steps: NormalizedWorkflowStep[];
  outputs: NormalizedWorkflowOutput[];
};

/**
 * @brief Result of normalizing one task node into a CommandLineTool representation.
 *
 * In addition to the normalized tool document, the result also contains identifier maps
 * used later when wiring workflow steps and outputs.
 */
export type TaskNormalizationResult = {
  tool: NormalizedCommandLineTool;
  paramIdToInputId: Map<string, string>;
  inputPortIdToInputId: Map<string, string>;
  outputPortIdToOutputId: Map<string, string>;
  diagnostics: ExportDiagnostic[];
};

/**
 * @brief Metadata describing one normalized workflow step.
 *
 * The structure keeps track of generated step identifiers and port-to-id mappings
 * needed when connecting workflow edges.
 */
export type WorkflowStepInfo = {
  nodeId: string;
  stepId: string;
  runPath: string;
  inputPortIdToInputId: Map<string, string>;
  outputPortIdToOutputId: Map<string, string>;
};

/**
 * @brief Result of normalizing a workflow into intermediate export documents.
 *
 * It contains the normalized root workflow document, all generated child files
 * and diagnostics collected during normalization.
 */
export type WorkflowNormalizationResult = {
  workflowDoc: NormalizedWorkflowDoc;
  files: Array<{
    path: string;
    doc: NormalizedCommandLineTool | NormalizedWorkflowDoc;
  }>;
  diagnostics: ExportDiagnostic[];
};

/**
 * @brief Context object passed through the export pipeline.
 *
 * The context currently contains the workflow being exported and can be extended later
 * with additional export settings or shared state.
 */
export type ExportContext = {
  workflow: Workflow;
};