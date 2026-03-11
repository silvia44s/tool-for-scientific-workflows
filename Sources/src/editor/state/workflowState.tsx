/**
 * @file workflowState.tsx
 * @brief Global state management for the workflow editor.
 * @author Silvia Šlachtovská 
 *
 * This file contains the main React context and reducer used to manage
 * the workflow graph. It stores nodes, edges and selection state and
 * provides actions for modifying them.
 *
 * The state is shared across the application using React Context.
 * Components can access it using the `useWorkflowState()` hook.
 */

import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type { Workflow, WorkflowEdge, WorkflowNode, TaskNode, ParamKind, TaskParam, EnvVar, IOPort, PortDataType, TaskIO } from './model';

/**
 * @brief Global editor state.
 *
 * Stores the current workflow along with information about
 * which node or edge is currently selected in the editor.
 */
type State = {
  workflow: Workflow;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
};


/**
 * @brief All possible actions that can modify the workflow state.
 *
 * The reducer reacts to these actions and updates the workflow
 * structure accordingly.
 */
type Action =
  | { type: 'workflow/setName'; name: string }
  | { type: 'workflow/setResultsRoot'; resultsRoot?: string }
  | { type: 'selection/set'; nodeId: string | null }
  | { type: 'selection/setEdge'; edgeId: string | null }
  | { type: 'node/addTask'; position: { x: number; y: number } }
  | { type: 'node/update'; nodeId: string; patch: Partial<WorkflowNode> }
  | { type: 'node/setPosition'; nodeId: string; position: { x: number; y: number } }
  | { type: 'edge/add'; edge: Omit<WorkflowEdge, 'id'> }
  | { type: 'edge/remove'; edgeId: string }
  | { type: 'task/paramAdd'; nodeId: string; param: TaskParam }
  | { type: 'task/paramUpdate'; nodeId: string; paramId: string; patch: Partial<{ name: string; flag?: string; value: string; required: boolean; description: string; options: string[]; exposeAsInput: boolean; exposeAsOutput: boolean; }> }
  | { type: 'task/paramRemove'; nodeId: string; paramId: string }
  | { type: 'task/envVarAdd'; nodeId: string; variable: EnvVar }
  | { type: 'task/envVarUpdate'; nodeId: string; varId: string; patch: Partial<{ key: string; value: string }> }
  | { type: 'task/envVarRemove'; nodeId: string; varId: string }

  | { type: 'task/moduleAdd'; nodeId: string; moduleName: string }
  | { type: 'task/moduleUpdate'; nodeId: string; index: number; moduleName: string }
  | { type: 'task/moduleRemove'; nodeId: string; index: number }

  | { type: 'task/libraryAdd'; nodeId: string; library: string }
  | { type: 'task/libraryUpdate'; nodeId: string; index: number; library: string }
  | { type: 'task/libraryRemove'; nodeId: string; index: number }
  | { type: 'workflow/replace'; workflow: Workflow }
  | { type: 'node/remove'; nodeId: string }
  | { type: 'node/addPresetNode'; node: WorkflowNode };


/**
 * @brief Generates a simple unique ID.
 *
 * Used for creating node, edge and workflow identifiers.
 */  
function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * @brief Creates an empty workflow object.
 *
 * This is used when the application starts or when
 * a new workflow is created.
 */
function createInitialWorkflow(): Workflow {
  return {
    schemaVersion: 1,
    id: uid('wf'),
    name: 'My Workflow',
    canvas: { viewport: { x: 0, y: 0, zoom: 1 } },
    nodes: {},
    edges: {},
  };
}

/**
 * @brief Main reducer function for workflow state updates.
 *
 * Handles all actions such as:
 * - adding/removing nodes
 * - connecting nodes with edges
 * - modifying task parameters
 * - selecting nodes or edges
 *
 * The reducer always returns a new state object.
 */
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'workflow/setName': {
      return { ...state, workflow: { ...state.workflow, name: action.name } };
    }

    case 'workflow/setResultsRoot': {
      return {
        ...state,
        workflow: {
          ...state.workflow,
          run: {
            ...(state.workflow.run ?? {}),
            resultsRoot: action.resultsRoot,
          },
        },
      };
    }

    case 'selection/set': {
      return { ...state, selectedNodeId: action.nodeId, selectedEdgeId: null, };
    }

    case 'selection/setEdge': {
      return { ...state, selectedEdgeId: action.edgeId, selectedNodeId: null, };
    }

    case 'node/addTask': {
      const id = uid('node');
      const node: TaskNode = {
          id,
          type: 'task',
          name: 'Task',
          position: action.position,
          task: {
          config: { binaryPath: '', workdir: '', argsTemplate: '' },
          params: [],
          environment: { variables: [], modules: [], libraries: [] },
          io: { inputs: [], outputs: [] },
          batch: { backend: 'local', array: { enabled: false } },
          },
      };
      const nodeSynced = syncPortsForTask(node);

      return {
          ...state,
          selectedNodeId: id,
          workflow: {
          ...state.workflow,
          nodes: { ...state.workflow.nodes, [id]: nodeSynced },
          },
      };
    }

    case 'node/update': {
      const existing = state.workflow.nodes[action.nodeId];
      if (!existing) return state;
      const updated = { ...existing, ...action.patch } as WorkflowNode;
      return {
        ...state,
        workflow: {
          ...state.workflow,
          nodes: { ...state.workflow.nodes, [action.nodeId]: updated },
        },
      };
    }

    case 'node/setPosition': {
      const existing = state.workflow.nodes[action.nodeId];
      if (!existing) return state;
      const updated = { ...existing, position: action.position } as WorkflowNode;
      return {
        ...state,
        workflow: {
          ...state.workflow,
          nodes: { ...state.workflow.nodes, [action.nodeId]: updated },
        },
      };
    }

    case 'edge/add': {
      const exists = Object.values(state.workflow.edges).some(
        (e) =>
          e.source === action.edge.source &&
          e.target === action.edge.target &&
          e.sourceHandle === action.edge.sourceHandle &&
          e.targetHandle === action.edge.targetHandle
      );

      if (exists) return state;

      const id = uid('edge');
      const edge: WorkflowEdge = { id, ...action.edge };

      return {
        ...state,
        workflow: {
          ...state.workflow,
          edges: { ...state.workflow.edges, [id]: edge },
        },
      };
    }

    case 'edge/remove': {
      const { [action.edgeId]: _, ...rest } = state.workflow.edges;
      return {
        ...state,
        workflow: { ...state.workflow, edges: rest },
        selectedEdgeId: state.selectedEdgeId === action.edgeId ? null : state.selectedEdgeId,
      };
    }

    case 'task/paramAdd': {
      const node = state.workflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          params: [...node.task.params, action.param],
        },
      };

      const synced = syncPortsForTask(updated as TaskNode);
      const nodes = { ...state.workflow.nodes, [action.nodeId]: synced };

      return {
        ...state,
        workflow: {
          ...state.workflow,
          nodes,
          edges: removeEdgesWithMissingPorts(state.workflow.edges, nodes),
        },
      };
    }

    case 'task/paramUpdate': {
      const node = state.workflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const params = node.task.params.map((p) =>
          p.id === action.paramId ? { ...p, ...action.patch } : p
      );

      const updated: WorkflowNode = {
          ...node,
          task: { ...node.task, params },
      };

      const synced = syncPortsForTask(updated as TaskNode);
      const nodes = { ...state.workflow.nodes, [action.nodeId]: synced };

      return {
          ...state,
          workflow: {
            ...state.workflow,
            nodes,
            edges: removeEdgesWithMissingPorts(state.workflow.edges, nodes),
          },
      };
    }

    case 'task/paramRemove': {
      const node = state.workflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const params = node.task.params.filter((p) => p.id !== action.paramId);

      const updated: WorkflowNode = {
            ...node,
            task: { ...node.task, params },
      };

      const synced = syncPortsForTask(updated as TaskNode);
      const nodes = { ...state.workflow.nodes, [action.nodeId]: synced };

      return {
        ...state,
        workflow: {
          ...state.workflow,
          nodes,
          edges: removeEdgesWithMissingPorts(state.workflow.edges, nodes),
        },
      };
    }

    case 'task/envVarAdd': {
      const node = state.workflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          environment: {
            ...node.task.environment,
            variables: [...node.task.environment.variables, action.variable],
          },
        },
      };

      return {
        ...state,
        workflow: { ...state.workflow, nodes: { ...state.workflow.nodes, [action.nodeId]: updated } },
      };
    }

    case 'task/envVarUpdate': {
      const node = state.workflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const variables = node.task.environment.variables.map((v) =>
        v.id === action.varId ? { ...v, ...action.patch } : v
      );

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          environment: { ...node.task.environment, variables },
        },
      };

      return {
        ...state,
        workflow: { ...state.workflow, nodes: { ...state.workflow.nodes, [action.nodeId]: updated } },
      };
    }

    case 'task/envVarRemove': {
      const node = state.workflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const variables = node.task.environment.variables.filter((v) => v.id !== action.varId);

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          environment: { ...node.task.environment, variables },
        },
      };

      return {
        ...state,
        workflow: { ...state.workflow, nodes: { ...state.workflow.nodes, [action.nodeId]: updated } },
      };
    }

    case 'task/moduleAdd': {
      const node = state.workflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          environment: {
            ...node.task.environment,
            modules: [...node.task.environment.modules, action.moduleName],
          },
        },
      };

      return {
        ...state,
        workflow: { ...state.workflow, nodes: { ...state.workflow.nodes, [action.nodeId]: updated } },
      };
    }

    case 'task/moduleUpdate': {
      const node = state.workflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const modules = node.task.environment.modules.map((m, i) =>
        i === action.index ? action.moduleName : m
      );

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          environment: { ...node.task.environment, modules },
        },
      };

      return {
        ...state,
        workflow: { ...state.workflow, nodes: { ...state.workflow.nodes, [action.nodeId]: updated } },
      };
    }

    case 'task/moduleRemove': {
      const node = state.workflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const modules = node.task.environment.modules.filter((_, i) => i !== action.index);

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          environment: { ...node.task.environment, modules },
        },
      };

      return {
        ...state,
        workflow: { ...state.workflow, nodes: { ...state.workflow.nodes, [action.nodeId]: updated } },
      };
    }

    case 'task/libraryAdd': {
      const node = state.workflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          environment: {
            ...node.task.environment,
            libraries: [...node.task.environment.libraries, action.library],
          },
        },
      };

      return {
        ...state,
        workflow: { ...state.workflow, nodes: { ...state.workflow.nodes, [action.nodeId]: updated } },
      };
    }

    case 'task/libraryUpdate': {
      const node = state.workflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const libraries = node.task.environment.libraries.map((l, i) =>
        i === action.index ? action.library : l
      );

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          environment: { ...node.task.environment, libraries },
        },
      };

      return {
        ...state,
        workflow: { ...state.workflow, nodes: { ...state.workflow.nodes, [action.nodeId]: updated } },
      };
    }

    case 'task/libraryRemove': {
      const node = state.workflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const libraries = node.task.environment.libraries.filter((_, i) => i !== action.index);

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          environment: { ...node.task.environment, libraries },
        },
      };

      return {
        ...state,
        workflow: { ...state.workflow, nodes: { ...state.workflow.nodes, [action.nodeId]: updated } },
      };
    }

    case 'workflow/replace': {
      return {
        ...state,
        workflow: action.workflow,
        selectedNodeId: null,
      };
    }

    case 'node/remove': {
      const { [action.nodeId]: _, ...restNodes } = state.workflow.nodes;

      const restEdges: typeof state.workflow.edges = {};
      for (const [eid, e] of Object.entries(state.workflow.edges)) {
        if (e.source === action.nodeId) continue;
        if (e.target === action.nodeId) continue;
        restEdges[eid] = e;
      }

      return {
        ...state,
        workflow: {
          ...state.workflow,
          nodes: restNodes,
          edges: restEdges,
        },
        selectedNodeId: state.selectedNodeId === action.nodeId ? null : state.selectedNodeId,
        selectedEdgeId: null,
      };
    }

    case 'node/addPresetNode': {
      return {
        ...state,
        workflow: {
          ...state.workflow,
          nodes: {
            ...state.workflow.nodes,
            [action.node.id]: action.node,
          },
        },
      };
    }
    
    default:
      return state;
  }
}

/**
 * @brief React context used to expose workflow state.
 *
 * Components can read and modify the workflow using
 * the provided `state` and `dispatch`.
 */
const Ctx = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

/**
 * @brief Context provider for the workflow editor.
 *
 * Wraps the application and provides global access
 * to workflow state and reducer actions.
 */
export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    workflow: createInitialWorkflow(),
    selectedNodeId: null,
    selectedEdgeId: null,
  });

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * @brief Custom hook for accessing workflow state.
 *
 * This is the main way components interact with the
 * workflow store.
 *
 * @throws Error if used outside of WorkflowProvider.
 */
export function useWorkflowState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkflowState must be used inside WorkflowProvider');
  return ctx;
}

/**
 * @brief Converts parameter type to port data type.
 *
 * Used when creating input/output ports for task nodes.
 */
function paramKindToPortType(kind: ParamKind): PortDataType {
  switch (kind) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'bool': return 'boolean';
    case 'choice': return 'string';
    case 'file': return 'file';
    case 'directory': return 'directory';
  }
}

/**
 * @brief Generates ID for an input port.
 */
function makeInputPortId(paramId: string) {
  return `in_${paramId}`;
}

/**
 * @brief Generates ID for an output port.
 */
function makeOutputPortId(paramId: string) {
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
function syncPortsForTask(node: TaskNode): TaskNode {
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
function removeEdgesWithMissingPorts(
  edges: Record<string, WorkflowEdge>,
  nodes: Record<string, WorkflowNode>
) {
  const result: typeof edges = {};

  for (const [id, e] of Object.entries(edges)) {
    const srcNode = nodes[e.source];
    const dstNode = nodes[e.target];

    if (!srcNode || !dstNode) continue;
    if (srcNode.type !== 'task' || dstNode.type !== 'task') continue;

    const srcExists = srcNode.task.io.outputs.some(p => p.id === e.sourceHandle);
    const dstExists = dstNode.task.io.inputs.some(p => p.id === e.targetHandle);

    if (srcExists && dstExists) {
      result[id] = e;
    }
  }

  return result;
}