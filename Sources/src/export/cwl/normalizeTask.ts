/**
 * @file normalizeTask.ts
 * @brief Normalizes task nodes into an intermediate CWL CommandLineTool representation.
 *
 * This file transforms a task node from the internal workflow model into a normalized
 * structure suitable for later rendering as a CWL CommandLineTool document.
 * It also produces identifier mappings and diagnostics needed by higher export layers.
 */

import type { TaskNode } from '../../domain/workflow/model/model';

import type {
  TaskNormalizationResult,
  NormalizedCommandLineTool,
  NormalizedCwlInput,
  NormalizedCwlOutput,
} from './types';

import {
  inferCwlParamType,
  makeOutputId,
  parseCwlInputDefault,
  slugify,
  uniqueName,
} from './utils';

import { error } from './diagnostics';

/**
 * @brief Normalizes a task node into a CWL CommandLineTool-compatible structure.
 *
 * The normalization process converts task parameters into CWL inputs,
 * output ports into CWL outputs, collects environment variables and builds
 * mapping tables between original workflow identifiers and exported CWL identifiers.
 * Any invalid or incomplete references are reported as export diagnostics.
 *
 * @param node Task node to normalize.
 * @return Normalized task export result containing the tool document, identifier mappings and diagnostics.
 */
export function normalizeTaskNode(node: TaskNode): TaskNormalizationResult {
  const diagnostics = [];
  const usedInputIds = new Set<string>();
  const usedOutputIds = new Set<string>();

  const paramIdToInputId = new Map<string, string>();
  const inputPortIdToInputId = new Map<string, string>();
  const outputPortIdToOutputId = new Map<string, string>();

  const env: Record<string, string> = {};
  for (const v of node.task.environment.variables) {
    if (!v.key.trim()) continue;
    env[v.key] = v.value;
  }

  const inputs: NormalizedCwlInput[] = [];
  let position = 1;

  for (const param of node.task.params) {
    const inputId = uniqueName(
      slugify(param.name || param.id, `param_${param.id}`),
      usedInputIds
    );
    paramIdToInputId.set(param.id, inputId);

    const input: NormalizedCwlInput = {
      id: inputId,
      type: inferCwlParamType(node, param),
    };

    const defaultValue = parseCwlInputDefault(node, param);
    if (defaultValue !== undefined) {
      input.default = defaultValue;
    }

    if (param.description?.trim()) {
      input.doc = param.description;
    }

    if ((param.flag || '').trim()) {
      input.inputBinding = {
        prefix: param.flag,
        position,
      };
      position += 1;
    }

    inputs.push(input);
  }

  for (const port of node.task.io.inputs) {
    const bind = port.inputBind;

    if (bind?.kind !== 'param') continue;

    const inputId = paramIdToInputId.get(bind.paramId);
    if (!inputId) {
      diagnostics.push(
        error(`Input port '${port.id}' references missing parameter '${bind.paramId}'.`, {
          nodeId: node.id,
          portId: port.id,
          paramId: bind.paramId,
        })
      );
      continue;
    }

    inputPortIdToInputId.set(port.id, inputId);
  }

  const outputs: NormalizedCwlOutput[] = [];

  for (const port of node.task.io.outputs) {
    const outputId = uniqueName(makeOutputId(node, port), usedOutputIds);
    outputPortIdToOutputId.set(port.id, outputId);

    let glob: string | undefined;
    const src = port.outputSource;

    if (src?.kind === 'fromParam') {
      const inputId = paramIdToInputId.get(src.paramId);
      if (!inputId) {
        diagnostics.push(
          error(`Output port '${port.id}' references missing parameter '${src.paramId}'.`, {
            nodeId: node.id,
            portId: port.id,
            paramId: src.paramId,
          })
        );
      } else {
        glob = `$(inputs.${inputId})`;
      }
    } else if (src?.kind === 'template') {
      glob = src.template;
    } else {
      diagnostics.push(
        error(`Output port '${port.id}' has no supported outputSource.`, {
          nodeId: node.id,
          portId: port.id,
        })
      );
    }

    const output: NormalizedCwlOutput = {
      id: outputId,
      type:
        port.dataType === 'file'
          ? 'File'
          : port.dataType === 'directory'
            ? 'Directory'
            : port.dataType === 'number'
              ? 'double'
              : port.dataType === 'boolean'
                ? 'boolean'
                : 'string',
    };

    if (port.description?.trim()) {
      output.doc = port.description;
    }

    if (glob) {
      output.glob = glob;
    }

    outputs.push(output);
  }

  const tool: NormalizedCommandLineTool = {
    kind: 'CommandLineTool',
    label: node.name,
    baseCommand: node.task.config.binaryPath,
    env,
    inputs,
    outputs,
  };

  return {
    tool,
    paramIdToInputId,
    inputPortIdToInputId,
    outputPortIdToOutputId,
    diagnostics,
  };
}