import type { NormalizedWorkflowDoc } from './types';
import { yamlScalar } from './utils';

export function renderWorkflow(doc: NormalizedWorkflowDoc): string {
  const lines: string[] = [];

  lines.push('cwlVersion: v1.2');
  lines.push('class: Workflow');
  lines.push(`label: ${yamlScalar(doc.label)}`);

  if (doc.requirements.subworkflowFeature) {
    lines.push('requirements:');
    lines.push('  SubworkflowFeatureRequirement: {}');
  }

  if (doc.inputs.length === 0) {
    lines.push('inputs: {}');
  } else {
    lines.push('inputs:');
    for (const input of doc.inputs) {
      lines.push(`  ${input.id}: ${input.type}`);
    }
  }

  lines.push('steps:');
  for (const step of doc.steps) {
    lines.push(`  ${step.id}:`);
    lines.push(`    run: ${step.run}`);

    if (step.in.length === 0) {
      lines.push('    in: {}');
    } else {
      lines.push('    in:');
      for (const stepIn of step.in) {
        lines.push(`      ${stepIn.id}: ${stepIn.source}`);
      }
    }

    if (step.out.length === 0) {
      lines.push('    out: []');
    } else {
      lines.push('    out:');
      for (const out of step.out) {
        lines.push(`      - ${out}`);
      }
    }
  }

  if (doc.outputs.length === 0) {
    lines.push('outputs: {}');
  } else {
    lines.push('outputs:');
    for (const output of doc.outputs) {
      lines.push(`  ${output.id}:`);
      lines.push(`    type: ${output.type}`);
      lines.push(`    outputSource: ${output.outputSource}`);
    }
  }

  return `${lines.join('\n')}\n`;
}