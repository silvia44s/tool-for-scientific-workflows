import type { Workflow } from '../../editor/state/model';

export type CwlFile = {
  path: string;
  content: string;
};

export type CwlBundle = {
  rootPath: string;
  rootContent: string;
  files: CwlFile[];
};

export type ExportDiagnostic = {
  level: 'error' | 'warning';
  message: string;
  nodeId?: string;
  portId?: string;
  paramId?: string;
};

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

export type NormalizedInputBinding = {
  prefix?: string;
  position?: number;
};

export type NormalizedCwlInput = {
  id: string;
  type: string;
  default?: string | number | boolean;
  doc?: string;
  inputBinding?: NormalizedInputBinding;
};

export type NormalizedCwlOutput = {
  id: string;
  type: string;
  doc?: string;
  glob?: string;
};

export type NormalizedCommandLineTool = {
  kind: 'CommandLineTool';
  label: string;
  baseCommand: string;
  env: Record<string, string>;
  inputs: NormalizedCwlInput[];
  outputs: NormalizedCwlOutput[];
};

export type NormalizedWorkflowInput = {
  id: string;
  type: string;
};

export type NormalizedWorkflowStepInput = {
  id: string;
  source: string;
};

export type NormalizedWorkflowStep = {
  id: string;
  run: string;
  in: NormalizedWorkflowStepInput[];
  out: string[];
};

export type NormalizedWorkflowOutput = {
  id: string;
  type: string;
  outputSource: string;
};

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

export type TaskNormalizationResult = {
  tool: NormalizedCommandLineTool;
  paramIdToInputId: Map<string, string>;
  inputPortIdToInputId: Map<string, string>;
  outputPortIdToOutputId: Map<string, string>;
  diagnostics: ExportDiagnostic[];
};

export type WorkflowStepInfo = {
  nodeId: string;
  stepId: string;
  runPath: string;
  inputPortIdToInputId: Map<string, string>;
  outputPortIdToOutputId: Map<string, string>;
};

export type WorkflowNormalizationResult = {
  workflowDoc: NormalizedWorkflowDoc;
  files: Array<{
    path: string;
    doc: NormalizedCommandLineTool | NormalizedWorkflowDoc;
  }>;
  diagnostics: ExportDiagnostic[];
};

export type ExportContext = {
  workflow: Workflow;
};