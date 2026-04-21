/**
 * @file workflowSchema.ts
 * @brief Defines the Zod schema and semantic validation rules for imported workflow documents.
 *
 * This file contains the structural schema used to validate the JSON representation
 * of a workflow editor document. In addition to basic shape validation, it also
 * performs semantic checks such as:
 * - consistency between record keys and object identifiers,
 * - existence of referenced nodes and ports,
 * - validity of task parameter bindings,
 * - correctness of subworkflow boundary mappings.
 */

import { z } from 'zod';

/* enums */

const NodeTypeSchema = z.enum(['task', 'subworkflow']);

const ParamKindSchema = z.enum([
  'string',
  'number',
  'bool',
  'choice',
  'file',
  'directory',
]);

const PortDataTypeSchema = z.enum([
  'file',
  'directory',
  'string',
  'number',
  'boolean',
]);

const PortDirectionSchema = z.enum(['input', 'output']);
const WorkflowBackendSchema = z.enum(['local', 'slurm', 'pbs']);

/* primitive reusable parts */

const Vec2Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const EnvVarSchema = z.object({
  id: z.string().min(1),
  key: z.string(),
  value: z.string(),
});

const OutputSourceSchema = z.union([
  z.object({
    kind: z.literal('fromParam'),
    paramId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('template'),
    template: z.string(),
  }),
]);

const IOPortSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  direction: PortDirectionSchema,
  dataType: PortDataTypeSchema,
  description: z.string().optional(),
  inputBind: z
    .object({
      kind: z.literal('param'),
      paramId: z.string().min(1),
    })
    .optional(),
  outputSource: OutputSourceSchema.optional(),
});

const TaskIOSchema = z.object({
  inputs: z.array(IOPortSchema),
  outputs: z.array(IOPortSchema),
});

const TaskParamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  flag: z.string().optional(),
  kind: ParamKindSchema,
  value: z.string(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  description: z.string().optional(),
  exposeAsInput: z.boolean().optional(),
  exposeAsOutput: z.boolean().optional(),
});

const EnvironmentConfigSchema = z.object({
  variables: z.array(EnvVarSchema),
  modules: z.array(z.string()),
  libraries: z.array(z.string()),
});

const BatchArraySchema = z.object({
  enabled: z.boolean(),
  start: z.number().optional(),
  end: z.number().optional(),
  step: z.number().optional(),
});

const TaskBatchConfigSchema = z.object({
  cpus: z.number().optional(),
  memMB: z.number().optional(),
  timeMin: z.number().optional(),
  partitionOrQueue: z.string().optional(),
  account: z.string().optional(),
  qos: z.string().optional(),
  array: BatchArraySchema.optional(),
  custom: z.string().optional(),
  customDirectives: z.string().optional(),
  prologue: z.string().optional(),
  epilogue: z.string().optional(),
});

const TaskConfigSchema = z.object({
  binaryPath: z.string(),
  workdir: z.string().optional(),
  argsTemplate: z.string().optional(),
});

const NodeBaseSchema = z.object({
  id: z.string().min(1),
  type: NodeTypeSchema,
  position: Vec2Schema,
  name: z.string(),
});

const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

const TaskNodeSchema = NodeBaseSchema.extend({
  type: z.literal('task'),
  task: z.object({
    config: TaskConfigSchema,
    params: z.array(TaskParamSchema),
    environment: EnvironmentConfigSchema,
    io: TaskIOSchema,
    batch: TaskBatchConfigSchema,
  }),
});

const SubworkflowBoundarySchema = z.object({
  inputs: z.array(
    z.object({
      portId: z.string().min(1),
      targetNodeId: z.string().min(1),
      targetPortId: z.string().min(1),
    })
  ),
  outputs: z.array(
    z.object({
      portId: z.string().min(1),
      sourceNodeId: z.string().min(1),
      sourcePortId: z.string().min(1),
    })
  ),
});

/* helper types for semantic validation */

/**
 * @brief Path representation used when reporting semantic validation issues.
 *
 * The path matches Zod issue paths and is used to point to the exact
 * location of an invalid property inside the workflow document.
 */
type ValidationPath = Array<string | number>;

/**
 * @brief Lightweight internal representation of a workflow node used during semantic validation.
 *
 * This type does not model the full workflow domain object. It contains only the fields
 * needed by validation helpers to verify node references, port bindings and subworkflow boundaries.
 */
type NodeLike = {
  type?: 'task' | 'subworkflow';
  id?: string;
  task?: {
    params?: Array<{
      id: string;
      kind?: string;
      options?: string[];
    }>;
    io?: {
      inputs?: Array<{
        id: string;
        direction?: string;
        inputBind?: { kind?: string; paramId?: string };
      }>;
      outputs?: Array<{
        id: string;
        direction?: string;
        outputSource?: { kind?: string; paramId?: string };
      }>;
    };
  };
  description?: string;
  subworkflow?: {
    workflow?: {
      nodes?: Record<string, NodeLike>;
    };
    io?: {
      inputs?: Array<{ id: string }>;
      outputs?: Array<{ id: string }>;
    };
    boundary?: {
      inputs?: Array<{
        portId: string;
        targetNodeId: string;
        targetPortId: string;
      }>;
      outputs?: Array<{
        portId: string;
        sourceNodeId: string;
        sourcePortId: string;
      }>;
    };
  };
};

/**
 * @brief Lightweight internal representation of a workflow used during semantic validation.
 *
 * It contains only the node and edge collections required for reference checks.
 */
type WorkflowLike = {
  nodes?: Record<string, NodeLike>;
  edges?: Record<
    string,
    {
      id?: string;
      source: string;
      target: string;
      sourceHandle?: string;
      targetHandle?: string;
    }
  >;
};

/* recursive workflow */

const SubworkflowNodeSchema: z.ZodType<NodeLike> = NodeBaseSchema.extend({
  type: z.literal('subworkflow'),
  description: z.string().optional(),
  subworkflow: z.object({
    workflow: z.lazy(() => WorkflowSchema),
    io: TaskIOSchema,
    boundary: SubworkflowBoundarySchema,
  }),
});

const WorkflowNodeSchema: z.ZodType<NodeLike> = z.union([
  TaskNodeSchema,
  SubworkflowNodeSchema,
]);

/**
 * @brief Root schema used to validate imported workflow documents.
 *
 * The schema validates both the structural JSON format and additional semantic
 * constraints through custom refinement. It supports recursive validation of
 * nested subworkflows.
 */
export const WorkflowSchema: z.ZodType<WorkflowLike> = z.lazy(() =>
  z
    .object({
      schemaVersion: z.literal(1),
      id: z.string().min(1),
      name: z.string().min(1),
      run: z.object({
        resultsRoot: z.string().optional(),
        backend: WorkflowBackendSchema,
      }),
      canvas: z.object({
        viewport: z.object({
          x: z.number().finite(),
          y: z.number().finite(),
          zoom: z.number().finite(),
        }),
      }),
      nodes: z.record(z.string(), WorkflowNodeSchema),
      edges: z.record(z.string(), WorkflowEdgeSchema),
    })
    .superRefine((workflow, ctx) => {
      validateWorkflowSemantics(workflow, ctx);
    })
);

/* semantic validation helpers */

/**
 * @brief Adds a custom semantic validation issue to the current Zod context.
 *
 * This helper centralizes creation of custom issues to keep validation logic concise
 * and to ensure all semantic errors use a consistent format.
 *
 * @param ctx Zod refinement context receiving the validation issue.
 * @param path Path to the invalid value inside the workflow document.
 * @param message Human-readable validation error message.
 * @return Nothing.
 */
function addCustomIssue(
  ctx: z.RefinementCtx,
  path: ValidationPath,
  message: string
): void {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path,
    message,
  });
}

/**
 * @brief Returns the input and output port collections of a node.
 *
 * The helper abstracts over task and subworkflow node variants and provides
 * unified access to their port definitions.
 *
 * @param node Node whose IO definition should be retrieved.
 * @return Object containing input and output ports, or null if the node type is not recognized.
 */
function getNodeIO(node: NodeLike):
  | { inputs: Array<{ id: string }>; outputs: Array<{ id: string }> }
  | null {
  if (node.type === 'task') {
    return {
      inputs: node.task?.io?.inputs ?? [],
      outputs: node.task?.io?.outputs ?? [],
    };
  }

  if (node.type === 'subworkflow') {
    return {
      inputs: node.subworkflow?.io?.inputs ?? [],
      outputs: node.subworkflow?.io?.outputs ?? [],
    };
  }

  return null;
}

/**
 * @brief Collects identifiers of all ports of a given direction on a node.
 *
 * This helper is used when validating edge handles and subworkflow boundary mappings.
 *
 * @param node Node whose ports should be inspected.
 * @param direction Direction of ports to collect.
 * @return Set of port identifiers for the requested direction.
 */
function getPortIds(
  node: NodeLike,
  direction: 'input' | 'output'
): Set<string> {
  const io = getNodeIO(node);
  if (!io) return new Set();

  const ports = direction === 'input' ? io.inputs : io.outputs;
  return new Set(ports.map((port) => port.id));
}

/* semantics */

/**
 * @brief Performs semantic validation of a workflow document after structural schema validation.
 *
 * This function verifies cross-references inside the workflow, including node identifiers,
 * edge endpoints, port handles and node-specific semantic rules.
 *
 * @param workflow Parsed workflow-like object being validated.
 * @param ctx Zod refinement context used for reporting semantic issues.
 * @return Nothing.
 */
function validateWorkflowSemantics(
  workflow: WorkflowLike,
  ctx: z.RefinementCtx
): void {
  const nodes = workflow.nodes ?? {};
  const edges = workflow.edges ?? {};

  const nodeEntries = Object.entries(nodes);
  const nodeIds = new Set(nodeEntries.map(([id]) => id));

  for (const [nodeKey, node] of nodeEntries) {
    if (node.id !== nodeKey) {
      addCustomIssue(
        ctx,
        ['nodes', nodeKey, 'id'],
        `Node id "${node.id}" must match record key "${nodeKey}"`
      );
    }

    if (node.type === 'task') {
      validateTaskNodeSemantics(node, ctx, ['nodes', nodeKey]);
    }

    if (node.type === 'subworkflow') {
      validateSubworkflowNodeSemantics(node, ctx, ['nodes', nodeKey]);
    }
  }

  for (const [edgeKey, edge] of Object.entries(edges)) {
    if (edge.id !== edgeKey) {
      addCustomIssue(
        ctx,
        ['edges', edgeKey, 'id'],
        `Edge id "${edge.id}" must match record key "${edgeKey}"`
      );
    }

    if (!nodeIds.has(edge.source)) {
      addCustomIssue(
        ctx,
        ['edges', edgeKey, 'source'],
        `Source node "${edge.source}" does not exist`
      );
    }

    if (!nodeIds.has(edge.target)) {
      addCustomIssue(
        ctx,
        ['edges', edgeKey, 'target'],
        `Target node "${edge.target}" does not exist`
      );
    }

    const sourceNode = nodes[edge.source];
    const targetNode = nodes[edge.target];

    if (sourceNode && edge.sourceHandle) {
      const outputPortIds = getPortIds(sourceNode, 'output');

      if (!outputPortIds.has(edge.sourceHandle)) {
        addCustomIssue(
          ctx,
          ['edges', edgeKey, 'sourceHandle'],
          `Source handle "${edge.sourceHandle}" does not exist on node "${edge.source}"`
        );
      }
    }

    if (targetNode && edge.targetHandle) {
      const inputPortIds = getPortIds(targetNode, 'input');

      if (!inputPortIds.has(edge.targetHandle)) {
        addCustomIssue(
          ctx,
          ['edges', edgeKey, 'targetHandle'],
          `Target handle "${edge.targetHandle}" does not exist on node "${edge.target}"`
        );
      }
    }
  }
}

/**
 * @brief Validates semantic constraints specific to task nodes.
 *
 * The validation checks parameter definitions, input port bindings
 * and output port sources referencing task parameters.
 *
 * @param node Task-like node being validated.
 * @param ctx Zod refinement context used for reporting issues.
 * @param path Base path of the node inside the workflow document.
 * @return Nothing.
 */
function validateTaskNodeSemantics(
  node: NodeLike,
  ctx: z.RefinementCtx,
  path: ValidationPath
): void {
  const params = node.task?.params ?? [];
  const io = node.task?.io;
  const paramIds = new Set(params.map((param) => param.id));

  for (const [index, param] of params.entries()) {
    if (
      param.kind === 'choice' &&
      param.options !== undefined &&
      param.options.length === 0
    ) {
      addCustomIssue(
        ctx,
        [...path, 'task', 'params', index, 'options'],
        'Choice parameter must have at least one option'
      );
    }
  }

  for (const [index, port] of (io?.inputs ?? []).entries()) {
    if (port.direction !== 'input') {
      addCustomIssue(
        ctx,
        [...path, 'task', 'io', 'inputs', index, 'direction'],
        'Input port must have direction "input"'
      );
    }

    if (
      port.inputBind?.kind === 'param' &&
      port.inputBind.paramId &&
      !paramIds.has(port.inputBind.paramId)
    ) {
      addCustomIssue(
        ctx,
        [...path, 'task', 'io', 'inputs', index, 'inputBind', 'paramId'],
        `Referenced param "${port.inputBind.paramId}" does not exist`
      );
    }
  }

  for (const [index, port] of (io?.outputs ?? []).entries()) {
    if (port.direction !== 'output') {
      addCustomIssue(
        ctx,
        [...path, 'task', 'io', 'outputs', index, 'direction'],
        'Output port must have direction "output"'
      );
    }

    if (
      port.outputSource?.kind === 'fromParam' &&
      port.outputSource.paramId &&
      !paramIds.has(port.outputSource.paramId)
    ) {
      addCustomIssue(
        ctx,
        [...path, 'task', 'io', 'outputs', index, 'outputSource', 'paramId'],
        `Referenced param "${port.outputSource.paramId}" does not exist`
      );
    }
  }
}

/**
 * @brief Validates semantic constraints specific to subworkflow nodes.
 *
 * The validation checks whether boundary mappings reference existing
 * external ports, internal nodes and internal ports of the nested workflow.
 *
 * @param node Subworkflow-like node being validated.
 * @param ctx Zod refinement context used for reporting issues.
 * @param path Base path of the node inside the workflow document.
 * @return Nothing.
 */
function validateSubworkflowNodeSemantics(
  node: NodeLike,
  ctx: z.RefinementCtx,
  path: ValidationPath
): void {
  const sub = node.subworkflow;
  const internalNodes = sub?.workflow?.nodes ?? {};
  const internalNodeIds = new Set(Object.keys(internalNodes));
  const subInputPortIds = new Set((sub?.io?.inputs ?? []).map((port) => port.id));
  const subOutputPortIds = new Set((sub?.io?.outputs ?? []).map((port) => port.id));

  for (const [index, binding] of (sub?.boundary?.inputs ?? []).entries()) {
    if (!subInputPortIds.has(binding.portId)) {
      addCustomIssue(
        ctx,
        [...path, 'subworkflow', 'boundary', 'inputs', index, 'portId'],
        `Boundary input port "${binding.portId}" does not exist on subworkflow node`
      );
    }

    if (!internalNodeIds.has(binding.targetNodeId)) {
      addCustomIssue(
        ctx,
        [...path, 'subworkflow', 'boundary', 'inputs', index, 'targetNodeId'],
        `Internal target node "${binding.targetNodeId}" does not exist`
      );
      continue;
    }

    const targetNode = internalNodes[binding.targetNodeId];
    const inputPortIds = getPortIds(targetNode, 'input');

    if (!inputPortIds.has(binding.targetPortId)) {
      addCustomIssue(
        ctx,
        [...path, 'subworkflow', 'boundary', 'inputs', index, 'targetPortId'],
        `Internal target port "${binding.targetPortId}" does not exist on node "${binding.targetNodeId}"`
      );
    }
  }

  for (const [index, binding] of (sub?.boundary?.outputs ?? []).entries()) {
    if (!subOutputPortIds.has(binding.portId)) {
      addCustomIssue(
        ctx,
        [...path, 'subworkflow', 'boundary', 'outputs', index, 'portId'],
        `Boundary output port "${binding.portId}" does not exist on subworkflow node`
      );
    }

    if (!internalNodeIds.has(binding.sourceNodeId)) {
      addCustomIssue(
        ctx,
        [...path, 'subworkflow', 'boundary', 'outputs', index, 'sourceNodeId'],
        `Internal source node "${binding.sourceNodeId}" does not exist`
      );
      continue;
    }

    const sourceNode = internalNodes[binding.sourceNodeId];
    const outputPortIds = getPortIds(sourceNode, 'output');

    if (!outputPortIds.has(binding.sourcePortId)) {
      addCustomIssue(
        ctx,
        [...path, 'subworkflow', 'boundary', 'outputs', index, 'sourcePortId'],
        `Internal source port "${binding.sourcePortId}" does not exist on node "${binding.sourceNodeId}"`
      );
    }
  }
}