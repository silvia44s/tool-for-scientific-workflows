import type { Workflow } from '../../editor/state/model';
import type { CwlBundle, ExportResult, NormalizedWorkflowDoc } from './types';
import { hasErrors } from './diagnostics';
import { normalizeWorkflow } from './normalizeWorkflow';
import { renderCommandLineTool } from './renderCommandLineTool';
import { renderWorkflow } from './renderWorkflow';

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