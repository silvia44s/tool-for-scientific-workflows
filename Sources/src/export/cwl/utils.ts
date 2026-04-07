import type {
  ParamKind,
  PortDataType,
  TaskNode,
  TaskParam,
  IOPort,
  WorkflowNode,
  SubworkflowNode,
  Workflow,
} from '../../editor/state/model';

export function slugify(raw: string, fallback = 'item'): string {
  const s = (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return s || fallback;
}

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

export function yamlScalar(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(String(value ?? ''));
}

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

export function isParamBoundToInputPort(node: TaskNode, paramId: string): boolean {
  return node.task.io.inputs.some(
    p => p.inputBind?.kind === 'param' && p.inputBind.paramId === paramId
  );
}

export function isParamUsedAsOutputPath(node: TaskNode, paramId: string): boolean {
  return node.task.io.outputs.some(
    p => p.outputSource?.kind === 'fromParam' && p.outputSource.paramId === paramId
  );
}

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

export function findTaskInputPort(node: TaskNode, portId: string): IOPort | undefined {
  return node.task.io.inputs.find(p => p.id === portId);
}

export function findTaskOutputPort(node: TaskNode, portId: string): IOPort | undefined {
  return node.task.io.outputs.find(p => p.id === portId);
}

export function findNodeById(
  nodes: Record<string, WorkflowNode>,
  nodeId: string
): WorkflowNode | undefined {
  return nodes[nodeId];
}

export function getNodeInputPorts(node: WorkflowNode): IOPort[] {
  return node.type === 'task' ? node.task.io.inputs : node.subworkflow.io.inputs;
}

export function getNodeOutputPorts(node: WorkflowNode): IOPort[] {
  return node.type === 'task' ? node.task.io.outputs : node.subworkflow.io.outputs;
}

export function findNodeInputPort(
  node: WorkflowNode,
  portId: string
): IOPort | undefined {
  return getNodeInputPorts(node).find(p => p.id === portId);
}

export function findNodeOutputPort(
  node: WorkflowNode,
  portId: string
): IOPort | undefined {
  return getNodeOutputPorts(node).find(p => p.id === portId);
}

export function makeSubworkflowInputId(portName: string, fallback: string): string {
  return slugify(portName.replace(/^--/, ''), fallback);
}

export function makeSubworkflowOutputId(portName: string, fallback: string): string {
  return slugify(portName.replace(/^--/, ''), fallback);
}

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