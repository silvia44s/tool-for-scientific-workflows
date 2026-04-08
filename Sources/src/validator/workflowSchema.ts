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

/* recursive workflow */

export const WorkflowSchema: z.ZodType<any> = z.lazy(() =>
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

const SubworkflowNodeSchema: z.ZodType<any> = NodeBaseSchema.extend({
  type: z.literal('subworkflow'),
  description: z.string().optional(),
  subworkflow: z.object({
    workflow: WorkflowSchema,
    io: TaskIOSchema,
    boundary: SubworkflowBoundarySchema,
  }),
});

const WorkflowNodeSchema: z.ZodType<any> = z.union([
  TaskNodeSchema,
  SubworkflowNodeSchema,
]);

const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

/* semantics */

function validateWorkflowSemantics(workflow: any, ctx: z.RefinementCtx) {
  const nodes = workflow.nodes ?? {};
  const edges = workflow.edges ?? {};

  const nodeEntries = Object.entries(nodes);
  const nodeIds = new Set(nodeEntries.map(([id]) => id));

  for (const [nodeKey, node] of nodeEntries) {
    if (node.id !== nodeKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nodes', nodeKey, 'id'],
        message: `Node id "${node.id}" must match record key "${nodeKey}"`,
      });
    }

    if (node.type === 'task') {
      validateTaskNodeSemantics(node, ctx, ['nodes', nodeKey]);
    }

    if (node.type === 'subworkflow') {
      validateSubworkflowNodeSemantics(node, ctx, ['nodes', nodeKey]);
    }
  }

  for (const [edgeKey, edge] of Object.entries(edges) as Array<[string, any]>) {
    if (edge.id !== edgeKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['edges', edgeKey, 'id'],
        message: `Edge id "${edge.id}" must match record key "${edgeKey}"`,
      });
    }

    if (!nodeIds.has(edge.source)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['edges', edgeKey, 'source'],
        message: `Source node "${edge.source}" does not exist`,
      });
    }

    if (!nodeIds.has(edge.target)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['edges', edgeKey, 'target'],
        message: `Target node "${edge.target}" does not exist`,
      });
    }

    const sourceNode = nodes[edge.source];
    const targetNode = nodes[edge.target];

    if (sourceNode && edge.sourceHandle) {
      const outputPortIds = getOutputPortIds(sourceNode);
      if (!outputPortIds.has(edge.sourceHandle)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', edgeKey, 'sourceHandle'],
          message: `Source handle "${edge.sourceHandle}" does not exist on node "${edge.source}"`,
        });
      }
    }

    if (targetNode && edge.targetHandle) {
      const inputPortIds = getInputPortIds(targetNode);
      if (!inputPortIds.has(edge.targetHandle)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', edgeKey, 'targetHandle'],
          message: `Target handle "${edge.targetHandle}" does not exist on node "${edge.target}"`,
        });
      }
    }
  }
}

function validateTaskNodeSemantics(node: any, ctx: z.RefinementCtx, path: (string | number)[]) {
  const params = node.task?.params ?? [];
  const io = node.task?.io;
  const paramIds = new Set(params.map((p: any) => p.id));

  for (const [index, param] of params.entries()) {
    if (param.kind === 'choice' && param.options && param.options.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'task', 'params', index, 'options'],
        message: 'Choice parameter must have at least one option',
      });
    }
  }

  for (const [index, port] of (io?.inputs ?? []).entries()) {
    if (port.direction !== 'input') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'task', 'io', 'inputs', index, 'direction'],
        message: 'Input port must have direction "input"',
      });
    }

    if (port.inputBind?.kind === 'param' && !paramIds.has(port.inputBind.paramId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'task', 'io', 'inputs', index, 'inputBind', 'paramId'],
        message: `Referenced param "${port.inputBind.paramId}" does not exist`,
      });
    }
  }

  for (const [index, port] of (io?.outputs ?? []).entries()) {
    if (port.direction !== 'output') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'task', 'io', 'outputs', index, 'direction'],
        message: 'Output port must have direction "output"',
      });
    }

    if (port.outputSource?.kind === 'fromParam' && !paramIds.has(port.outputSource.paramId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'task', 'io', 'outputs', index, 'outputSource', 'paramId'],
        message: `Referenced param "${port.outputSource.paramId}" does not exist`,
      });
    }
  }
}

function validateSubworkflowNodeSemantics(node: any, ctx: z.RefinementCtx, path: (string | number)[]) {
  const sub = node.subworkflow;
  const internalNodes = sub.workflow?.nodes ?? {};
  const internalNodeIds = new Set(Object.keys(internalNodes));
  const subInputPortIds = new Set((sub.io?.inputs ?? []).map((p: any) => p.id));
  const subOutputPortIds = new Set((sub.io?.outputs ?? []).map((p: any) => p.id));

  for (const [index, binding] of (sub.boundary?.inputs ?? []).entries()) {
    if (!subInputPortIds.has(binding.portId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'subworkflow', 'boundary', 'inputs', index, 'portId'],
        message: `Boundary input port "${binding.portId}" does not exist on subworkflow node`,
      });
    }

    if (!internalNodeIds.has(binding.targetNodeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'subworkflow', 'boundary', 'inputs', index, 'targetNodeId'],
        message: `Internal target node "${binding.targetNodeId}" does not exist`,
      });
      continue;
    }

    const targetNode = internalNodes[binding.targetNodeId];
    const inputPortIds = getInputPortIds(targetNode);

    if (!inputPortIds.has(binding.targetPortId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'subworkflow', 'boundary', 'inputs', index, 'targetPortId'],
        message: `Internal target port "${binding.targetPortId}" does not exist on node "${binding.targetNodeId}"`,
      });
    }
  }

  for (const [index, binding] of (sub.boundary?.outputs ?? []).entries()) {
    if (!subOutputPortIds.has(binding.portId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'subworkflow', 'boundary', 'outputs', index, 'portId'],
        message: `Boundary output port "${binding.portId}" does not exist on subworkflow node`,
      });
    }

    if (!internalNodeIds.has(binding.sourceNodeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'subworkflow', 'boundary', 'outputs', index, 'sourceNodeId'],
        message: `Internal source node "${binding.sourceNodeId}" does not exist`,
      });
      continue;
    }

    const sourceNode = internalNodes[binding.sourceNodeId];
    const outputPortIds = getOutputPortIds(sourceNode);

    if (!outputPortIds.has(binding.sourcePortId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'subworkflow', 'boundary', 'outputs', index, 'sourcePortId'],
        message: `Internal source port "${binding.sourcePortId}" does not exist on node "${binding.sourceNodeId}"`,
      });
    }
  }
}

function getInputPortIds(node: any): Set<string> {
  if (node.type === 'task') {
    return new Set((node.task?.io?.inputs ?? []).map((p: any) => p.id));
  }
  if (node.type === 'subworkflow') {
    return new Set((node.subworkflow?.io?.inputs ?? []).map((p: any) => p.id));
  }
  return new Set();
}

function getOutputPortIds(node: any): Set<string> {
  if (node.type === 'task') {
    return new Set((node.task?.io?.outputs ?? []).map((p: any) => p.id));
  }
  if (node.type === 'subworkflow') {
    return new Set((node.subworkflow?.io?.outputs ?? []).map((p: any) => p.id));
  }
  return new Set();
}