/**
 * @file renderCommandLineTool.ts
 * @brief Renders a normalized CommandLineTool document into CWL YAML text.
 *
 * This file converts the intermediate normalized representation of a task node
 * into a textual CWL CommandLineTool document. The renderer emits YAML structure
 * for metadata, environment variables, inputs and outputs.
 */

import type { NormalizedCommandLineTool } from './types';
import { yamlScalar } from './utils';

/**
 * @brief Converts a normalized CommandLineTool document into CWL YAML text.
 *
 * The renderer serializes the command line tool structure including label,
 * base command, environment variables, input definitions and output bindings.
 *
 * @param doc Normalized CommandLineTool document to render.
 * @return CWL YAML string representing the command line tool.
 */
export function renderCommandLineTool(doc: NormalizedCommandLineTool): string {
  const lines: string[] = [];

  lines.push('cwlVersion: v1.2');
  lines.push('class: CommandLineTool');
  lines.push(`label: ${yamlScalar(doc.label)}`);
  lines.push(`baseCommand: ${yamlScalar(doc.baseCommand)}`);

  const envKeys = Object.keys(doc.env);
  if (envKeys.length > 0) {
    lines.push('requirements:');
    lines.push('  EnvVarRequirement:');
    lines.push('    envDef:');
    for (const key of envKeys) {
      lines.push(`      ${key}: ${yamlScalar(doc.env[key])}`);
    }
  }

  if (doc.inputs.length === 0) {
    lines.push('inputs: {}');
  } else {
    lines.push('inputs:');
    for (const input of doc.inputs) {
      lines.push(`  ${input.id}:`);
      lines.push(`    type: ${input.type}`);

      if (input.default !== undefined) {
        lines.push(`    default: ${yamlScalar(input.default)}`);
      }

      if (input.doc) {
        lines.push(`    doc: ${yamlScalar(input.doc)}`);
      }

      if (input.inputBinding) {
        lines.push('    inputBinding:');
        if (input.inputBinding.prefix !== undefined) {
          lines.push(`      prefix: ${yamlScalar(input.inputBinding.prefix)}`);
        }
        if (input.inputBinding.position !== undefined) {
          lines.push(`      position: ${input.inputBinding.position}`);
        }
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

      if (output.doc) {
        lines.push(`    doc: ${yamlScalar(output.doc)}`);
      }

      if (output.glob !== undefined) {
        lines.push('    outputBinding:');
        lines.push(`      glob: ${output.glob}`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}