/**
 * @file taskIoUtils.ts
 * @brief Utility functions for synchronizing task parameters with node ports.
 * @author Silvia Šlachtovská
 * 
 */


import type {
  ParamKind,
  PortDataType,
  IOPort,
  TaskIO,
  TaskNode,
  WorkflowEdge,
  WorkflowNode,
} from './model';

/**
 * @brief Converts parameter type to port data type.
 *
 * Used when creating input/output ports for task nodes.
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
 * @brief Generates ID for an input port.
 */
export function makeInputPortId(paramId: string) {
  return `in_${paramId}`;
}

/**
 * @brief Generates ID for an output port.
 */
export function makeOutputPortId(paramId: string) {
  return `out_${paramId}`;
}

/**
 * @brief Synchronizes node ports with task parameters.
 *
 * If a parameter is marked as exposed input/output,
 * a corresponding port is created on the node.
 *
 * Existing ports are preserved when possible to
 * avoid breaking existing edges.
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
 * @brief Removes edges that reference ports that no longer exist.
 *
 * This is needed when parameters are removed or their exposure
 * settings change, which can invalidate existing connections.
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

export function getNodeIO(node: WorkflowNode): TaskIO | null {
  if (node.type === 'task') return node.task.io;
  if (node.type === 'subworkflow') return node.subworkflow.io;
  return null;
}