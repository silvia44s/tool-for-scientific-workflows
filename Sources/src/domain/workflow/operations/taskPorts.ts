/**
 * @file taskPorts.ts
 * @brief Utility functions for synchronizing task parameters with task node ports.
 * @author Silvia Šlachtovská
 *
 * This file contains helper functions that derive input and output ports
 * from task parameters, generate stable port identifiers, and remove
 * edges that reference ports no longer present on a node.
 */

import type {
  ParamKind,
  PortDataType,
  IOPort,
  TaskIO,
  TaskNode,
  WorkflowEdge,
  WorkflowNode,
} from '../model/model';

/**
 * @brief Converts a task parameter kind to the corresponding port data type.
 *
 * Used when generating workflow ports from exposed task parameters.
 *
 * @param kind Task parameter kind.
 * @return Matching workflow port data type.
 */
export function paramKindToPortType(kind: ParamKind): PortDataType {
  switch (kind) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'bool':
      return 'boolean';
    case 'choice':
      return 'string';
    case 'file':
      return 'file';
    case 'directory':
      return 'directory';
  }
}

/**
 * @brief Generates the identifier of an input port derived from a task parameter.
 *
 * @param paramId Identifier of the source parameter.
 * @return Generated input port identifier.
 */
export function makeInputPortId(paramId: string) {
  return `in_${paramId}`;
}

/**
 * @brief Generates the identifier of an output port derived from a task parameter.
 *
 * @param paramId Identifier of the source parameter.
 * @return Generated output port identifier.
 */
export function makeOutputPortId(paramId: string) {
  return `out_${paramId}`;
}

/**
 * @brief Synchronizes task node ports with currently exposed task parameters.
 *
 * Parameters marked as exposed inputs or outputs are converted into node ports.
 * Existing ports are preserved when identifiers match, which helps keep
 * existing valid connections stable across updates.
 *
 * @param node Task node whose ports should be synchronized.
 * @return Updated task node with synchronized input and output ports.
 */
export function syncPortsForTask(node: TaskNode): TaskNode {
  const io: TaskIO = node.task.io ?? { inputs: [], outputs: [] };

  const desiredInputs: IOPort[] = node.task.params
    .filter((p) => p.exposeAsInput)
    .map((p) => ({
      id: makeInputPortId(p.id),
      name: p.name,
      direction: 'input',
      dataType: paramKindToPortType(p.kind),
      inputBind: { kind: 'param', paramId: p.id },
    }));

  const desiredOutputs: IOPort[] = node.task.params
    .filter((p) => p.exposeAsOutput)
    .map((p) => ({
      id: makeOutputPortId(p.id),
      name: p.name,
      direction: 'output',
      dataType: paramKindToPortType(p.kind),
      outputSource: { kind: 'fromParam', paramId: p.id },
    }));

  const keepById = (existing: IOPort[], desired: IOPort[]) => {
    const existingMap = new Map(existing.map((x) => [x.id, x]));
    return desired.map((d) => existingMap.get(d.id) ?? d);
  };

  const inputs = keepById(io.inputs, desiredInputs);
  const outputs = keepById(io.outputs, desiredOutputs);

  return {
    ...node,
    task: {
      ...node.task,
      io: { inputs, outputs },
    },
  };
}

/**
 * @brief Removes edges that reference ports no longer present on workflow nodes.
 *
 * This function is used after task parameter changes that may alter
 * exposed ports and invalidate existing workflow connections.
 *
 * @param edges Edge collection to filter.
 * @param nodes Current workflow nodes used for port existence checks.
 * @return Filtered edge collection containing only valid connections.
 */
export function removeEdgesWithMissingPorts(
  edges: Record<string, WorkflowEdge>,
  nodes: Record<string, WorkflowNode>
) {
  const result: typeof edges = {};

  for (const [id, e] of Object.entries(edges)) {
    const srcNode = nodes[e.source];
    const dstNode = nodes[e.target];

    if (!srcNode || !dstNode) continue;

    const srcIO = getNodeIO(srcNode);
    const dstIO = getNodeIO(dstNode);

    if (!srcIO || !dstIO) continue;

    const srcExists = srcIO.outputs.some((p) => p.id === e.sourceHandle);
    const dstExists = dstIO.inputs.some((p) => p.id === e.targetHandle);

    if (srcExists && dstExists) {
      result[id] = e;
    }
  }

  return result;
}

/**
 * @brief Returns the input/output interface of a workflow node.
 *
 * This helper abstracts over task and subworkflow node variants.
 *
 * @param node Workflow node to inspect.
 * @return Node IO definition, or null if it cannot be resolved.
 */
export function getNodeIO(node: WorkflowNode): TaskIO | null {
  if (node.type === 'task') return node.task.io;
  if (node.type === 'subworkflow') return node.subworkflow.io;
  return null;
}