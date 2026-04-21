/**
 * @file utils.ts
 * @brief Provides helper functions used by the CWL export layer.
 *
 * This file contains utility functions for transforming workflow model values
 * into identifiers, CWL scalar values, port types and stable export ordering.
 * The helpers are shared across normalization and rendering steps of the export pipeline.
 */

import type {
  PortDataType,
  TaskNode,
  TaskParam,
  IOPort,
  WorkflowNode,
  Workflow,
} from '../../domain/workflow/model/model';

/**
 * @brief Converts arbitrary text into a normalized identifier-safe string.
 *
 * The function lowercases the input, replaces unsupported characters with underscores
 * and trims leading and trailing underscores. If the result is empty, the fallback is used.
 *
 * @param raw Raw input string.
 * @param fallback Fallback value used when the normalized result is empty.
 * @return Slugified identifier string.
 */
export function slugify(raw: string, fallback = 'item'): string {
  const s = (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return s || fallback;
}

/**
 * @brief Generates a unique name based on a base identifier.
 *
 * If the base name is already present in the provided set, a numeric suffix
 * is appended until a unique name is found. The resulting name is inserted into the set.
 *
 * @param base Preferred base name.
 * @param used Set of already used identifiers.
 * @return Unique identifier derived from the base name.
 */
export function uniqueName(base: string, used: Set<string>): string {
  let name = base;
  let i = 2;

  while (used.has(name)) {
    name = `${base}_${i}`;
    i += 1;
  }

  used.add(name);
  return name;
}

/**
 * @brief Converts a JavaScript value into a YAML-compatible scalar representation.
 *
 * Numbers and booleans are emitted as plain values, while all other values are
 * stringified as quoted JSON strings for safe embedding into YAML output.
 *
 * @param value Value to serialize.
 * @return YAML scalar string representation.
 */
export function yamlScalar(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(String(value ?? ''));
}

/**
 * @brief Parses the default value of a task parameter into a CWL-compatible type.
 *
 * The function interprets the textual parameter value according to the inferred CWL type.
 * Empty values are treated as undefined and are therefore omitted from exported defaults.
 *
 * @param node Task node containing the parameter definition.
 * @param param Parameter whose default value should be converted.
 * @return Parsed default value, or undefined if no valid CWL default can be produced.
 */
export function parseCwlInputDefault(
  node: TaskNode,
  param: TaskParam
): string | number | boolean | undefined {
  const raw = (param.value || '').trim();
  if (!raw) return undefined;

  const cwlType = inferCwlParamType(node, param).replace(/\?$/, '');

  switch (cwlType) {
    case 'double': {
      const n = Number(raw);
      return Number.isNaN(n) ? undefined : n;
    }
    case 'boolean':
      return ['true', '1', 'yes', 'on'].includes(raw.toLowerCase());
    case 'string':
      return raw;
    default:
      return undefined;
  }
}

/**
 * @brief Maps an internal port data type to a CWL type name.
 *
 * @param dataType Internal workflow port data type.
 * @return Corresponding CWL type name.
 */
export function toCwlPortType(dataType: PortDataType): string {
  switch (dataType) {
    case 'file':
      return 'File';
    case 'directory':
      return 'Directory';
    case 'number':
      return 'double';
    case 'boolean':
      return 'boolean';
    case 'string':
    default:
      return 'string';
  }
}

/**
 * @brief Checks whether a task parameter is bound to any input port.
 *
 * @param node Task node to inspect.
 * @param paramId Parameter identifier.
 * @return True if the parameter is referenced by an input port binding.
 */
export function isParamBoundToInputPort(node: TaskNode, paramId: string): boolean {
  return node.task.io.inputs.some(
    p => p.inputBind?.kind === 'param' && p.inputBind.paramId === paramId
  );
}

/**
 * @brief Checks whether a task parameter is used as a source of an output path.
 *
 * @param node Task node to inspect.
 * @param paramId Parameter identifier.
 * @return True if the parameter is referenced by an output port source.
 */
export function isParamUsedAsOutputPath(node: TaskNode, paramId: string): boolean {
  return node.task.io.outputs.some(
    p => p.outputSource?.kind === 'fromParam' && p.outputSource.paramId === paramId
  );
}

/**
 * @brief Infers the exported CWL type of a task parameter.
 *
 * The resulting type depends on both the parameter kind and its role inside the task,
 * for example whether it is used as an input binding or as an output path source.
 * Optional parameters are exported using the nullable CWL form with a trailing '?'.
 *
 * @param node Task node containing the parameter.
 * @param param Parameter whose CWL type should be inferred.
 * @return CWL type name, optionally marked as nullable.
 */
export function inferCwlParamType(node: TaskNode, param: TaskParam): string {
  const isInputParam = isParamBoundToInputPort(node, param.id);
  const isOutputPathParam = isParamUsedAsOutputPath(node, param.id);

  let base: string;

  switch (param.kind) {
    case 'file':
      base = isOutputPathParam && !isInputParam ? 'string' : 'File';
      break;
    case 'directory':
      base = isOutputPathParam && !isInputParam ? 'string' : 'Directory';
      break;
    case 'number':
      base = 'double';
      break;
    case 'bool':
      base = 'boolean';
      break;
    case 'choice':
    case 'string':
    default:
      base = 'string';
      break;
  }

  return param.required === false ? `${base}?` : base;
}

/**
 * @brief Creates a stable CWL output identifier for a task output port.
 *
 * The identifier is derived either from the referenced parameter or from the port name,
 * with additional suffixes for file and directory outputs.
 *
 * @param node Task node containing the output port.
 * @param port Output port definition.
 * @return Identifier suitable for exported CWL output names.
 */
export function makeOutputId(node: TaskNode, port: IOPort): string {
  const src = port.outputSource;

  if (src?.kind === 'fromParam') {
    const param = node.task.params.find(p => p.id === src.paramId);
    if (param) {
      if (port.dataType === 'file') return slugify(`${param.name}_file`, 'output_file');
      if (port.dataType === 'directory') return slugify(`${param.name}_dir`, 'output_dir');
      return slugify(param.name, 'output');
    }
  }

  const cleanName = (port.name || port.id).replace(/^--/, '');

  if (port.dataType === 'file') return slugify(`${cleanName}_file`, 'output_file');
  if (port.dataType === 'directory') return slugify(`${cleanName}_dir`, 'output_dir');
  return slugify(cleanName, 'output');
}

/**
 * @brief Finds an input port of a task node by identifier.
 *
 * @param node Task node to inspect.
 * @param portId Identifier of the input port.
 * @return Matching input port, or undefined if not found.
 */
export function findTaskInputPort(node: TaskNode, portId: string): IOPort | undefined {
  return node.task.io.inputs.find(p => p.id === portId);
}

/**
 * @brief Finds an output port of a task node by identifier.
 *
 * @param node Task node to inspect.
 * @param portId Identifier of the output port.
 * @return Matching output port, or undefined if not found.
 */
export function findTaskOutputPort(node: TaskNode, portId: string): IOPort | undefined {
  return node.task.io.outputs.find(p => p.id === portId);
}

/**
 * @brief Finds a workflow node by identifier.
 *
 * @param nodes Map of workflow nodes.
 * @param nodeId Identifier of the requested node.
 * @return Matching workflow node, or undefined if not found.
 */
export function findNodeById(
  nodes: Record<string, WorkflowNode>,
  nodeId: string
): WorkflowNode | undefined {
  return nodes[nodeId];
}

/**
 * @brief Returns all input ports of a workflow node.
 *
 * The helper abstracts over task and subworkflow node variants.
 *
 * @param node Workflow node.
 * @return Array of input ports.
 */
export function getNodeInputPorts(node: WorkflowNode): IOPort[] {
  return node.type === 'task' ? node.task.io.inputs : node.subworkflow.io.inputs;
}

/**
 * @brief Returns all output ports of a workflow node.
 *
 * The helper abstracts over task and subworkflow node variants.
 *
 * @param node Workflow node.
 * @return Array of output ports.
 */
export function getNodeOutputPorts(node: WorkflowNode): IOPort[] {
  return node.type === 'task' ? node.task.io.outputs : node.subworkflow.io.outputs;
}

/**
 * @brief Finds an input port of a workflow node by identifier.
 *
 * @param node Workflow node to inspect.
 * @param portId Identifier of the input port.
 * @return Matching input port, or undefined if not found.
 */
export function findNodeInputPort(
  node: WorkflowNode,
  portId: string
): IOPort | undefined {
  return getNodeInputPorts(node).find(p => p.id === portId);
}

/**
 * @brief Finds an output port of a workflow node by identifier.
 *
 * @param node Workflow node to inspect.
 * @param portId Identifier of the output port.
 * @return Matching output port, or undefined if not found.
 */
export function findNodeOutputPort(
  node: WorkflowNode,
  portId: string
): IOPort | undefined {
  return getNodeOutputPorts(node).find(p => p.id === portId);
}

/**
 * @brief Creates an identifier for a subworkflow input.
 *
 * @param portName Source port name.
 * @param fallback Fallback identifier when the normalized name is empty.
 * @return Identifier suitable for exported workflow input names.
 */
export function makeSubworkflowInputId(portName: string, fallback: string): string {
  return slugify(portName.replace(/^--/, ''), fallback);
}

/**
 * @brief Creates an identifier for a subworkflow output.
 *
 * @param portName Source port name.
 * @param fallback Fallback identifier when the normalized name is empty.
 * @return Identifier suitable for exported workflow output names.
 */
export function makeSubworkflowOutputId(portName: string, fallback: string): string {
  return slugify(portName.replace(/^--/, ''), fallback);
}

/**
 * @brief Produces a stable topological ordering of workflow node identifiers.
 *
 * Nodes are ordered according to edge dependencies whenever possible.
 * If the graph contains cycles or partial inconsistencies, the remaining nodes
 * are appended in stable sorted order as a fallback.
 *
 * @param workflow Workflow whose nodes should be ordered.
 * @return Array of node identifiers in export order.
 */
export function topologicallyOrderNodeIds(workflow: Workflow): string[] {
  const nodeIds = Object.keys(workflow.nodes).sort();
  const indegree = new Map<string, number>();
  const successors = new Map<string, string[]>();

  for (const nodeId of nodeIds) {
    indegree.set(nodeId, 0);
    successors.set(nodeId, []);
  }

  for (const edge of Object.values(workflow.edges)) {
    if (!workflow.nodes[edge.source] || !workflow.nodes[edge.target]) {
      continue;
    }

    successors.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  for (const [nodeId, succ] of successors.entries()) {
    succ.sort();
    successors.set(nodeId, succ);
  }

  const ready = nodeIds.filter(id => (indegree.get(id) ?? 0) === 0).sort();
  const ordered: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift()!;
    ordered.push(current);

    for (const next of successors.get(current) ?? []) {
      const newIndegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, newIndegree);

      if (newIndegree === 0) {
        ready.push(next);
        ready.sort();
      }
    }
  }

  // fallback for cycles / partial inconsistencies:
  // append anything not emitted yet in stable order
  for (const nodeId of nodeIds) {
    if (!ordered.includes(nodeId)) {
      ordered.push(nodeId);
    }
  }

  return ordered;
}