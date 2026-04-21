/**
 * @file bundleExporter.ts
 * @brief Provides the top-level export pipeline for converting workflows into CWL bundles.
 *
 * This file orchestrates workflow normalization, rendering of CWL documents,
 * generation of helper files and assembly of the final export bundle.
 */

import type { Workflow } from '../../domain/workflow/model/model';
import type { CwlBundle, ExportResult, NormalizedWorkflowDoc } from './types';
import { hasErrors } from './diagnostics';
import { normalizeWorkflow } from './normalizeWorkflow';
import { renderCommandLineTool } from './renderCommandLineTool';
import { renderWorkflow } from './renderWorkflow';

/**
 * @brief Builds a plain-text README file for the exported CWL bundle.
 *
 * The README describes the structure of the exported files and shows
 * a typical command-line invocation example.
 *
 * @return README file content.
 */
function buildReadme(): string {
  return [
    'CWL export bundle',
    '',
    'Root workflow:',
    '  workflow.cwl',
    '',
    'Tools:',
    '  tools/*.cwl',
    '',
    'Subworkflows:',
    '  subworkflows/*.cwl',
    '',
    'Typical usage:',
    '  cwltool workflow.cwl job.yml',
    '',
  ].join('\n');
}

/**
 * @brief Builds a sample CWL job input template for the root workflow.
 *
 * The template contains placeholder values for all workflow-level inputs
 * and can be used as a starting point for preparing a real job input file.
 *
 * @param workflowDoc Normalized root workflow document.
 * @return Generated job template content, or null if the workflow has no inputs.
 */
function buildInputsTemplate(workflowDoc: NormalizedWorkflowDoc): string | null {
  if (workflowDoc.inputs.length === 0) {
    return null;
  }

  const lines: string[] = [];

  for (const input of workflowDoc.inputs) {
    const type = input.type.replace(/\?$/, '');

    if (type === 'File') {
      lines.push(`${input.id}:`);
      lines.push('  class: File');
      lines.push(`  path: /path/to/${input.id}`);
      continue;
    }

    if (type === 'Directory') {
      lines.push(`${input.id}:`);
      lines.push('  class: Directory');
      lines.push(`  path: /path/to/${input.id}`);
      continue;
    }

    if (type === 'double') {
      lines.push(`${input.id}: 0`);
      continue;
    }

    if (type === 'boolean') {
      lines.push(`${input.id}: false`);
      continue;
    }

    lines.push(`${input.id}: ""`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * @brief Exports a workflow as a CWL bundle.
 *
 * The function normalizes the internal workflow model, renders all generated
 * workflow and tool documents into YAML text, appends helper files such as
 * a sample job input template and README, and returns the final export result.
 * If normalization produces errors, export is aborted and diagnostics are returned.
 *
 * @param workflow Workflow to export.
 * @return Export result containing either the generated bundle or diagnostics only.
 */
export function exportWorkflowAsCwl(workflow: Workflow): ExportResult {
  const normalized = normalizeWorkflow(workflow);

  if (hasErrors(normalized.diagnostics)) {
    return {
      ok: false,
      diagnostics: normalized.diagnostics,
    };
  }

  const files = normalized.files.map(file => ({
    path: file.path,
    content:
      file.doc.kind === 'Workflow'
        ? renderWorkflow(file.doc)
        : renderCommandLineTool(file.doc),
  }));

  const inputsTemplate = buildInputsTemplate(normalized.workflowDoc);
  if (inputsTemplate) {
    files.push({
      path: 'job.yml',
      content: inputsTemplate,
    });
  }

  files.push({
    path: 'README.txt',
    content: buildReadme(),
  });

  const root = files.find(f => f.path === 'workflow.cwl') ?? files[0];
  const bundle: CwlBundle = {
    rootPath: root.path,
    rootContent: root.content,
    files,
  };

  return {
    ok: true,
    bundle,
    diagnostics: normalized.diagnostics,
  };
}