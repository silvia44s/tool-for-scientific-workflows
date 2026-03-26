/**
 * @file workflowReducer.ts
 * @brief Reducer function for managing workflow state in the editor.
 * @author Silvia Šlachtovská
 * 
 */

import type {
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  TaskNode,
  TaskParam,
  EnvVar,
} from './model';
import {
  createSubworkflowFromSelection,
  ungroupSubworkflowNode,
} from './subworkflow';
import {
  getActiveWorkflow,
  updateWorkflowAtPath,
  uid,
} from './workflowUtils';
import {
  removeEdgesWithMissingPorts,
  syncPortsForTask,
} from './taskIoUtils';

/**
 * @brief Global editor state.
 *
 * Stores the current workflow along with information about
 * which node or edge is currently selected in the editor.
 */
export type State = {
  workflow: Workflow;
  activePath: string[];
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
};

/**
 * @brief All possible actions that can modify the workflow state.
 *
 * The reducer reacts to these actions and updates the workflow
 * structure accordingly.
 */
export type Action =
  | { type: 'workflow/setName'; name: string }
  | { type: 'workflow/setResultsRoot'; resultsRoot?: string }
  | { type: 'selection/setSingleNode'; nodeId: string | null }
  | { type: 'selection/toggleNode'; nodeId: string }
  | { type: 'selection/setNodes'; nodeIds: string[] }
  | { type: 'selection/clearNodes' }
  | { type: 'selection/setEdge'; edgeId: string | null }
  | { type: 'node/addTask'; position: { x: number; y: number } }
  | { type: 'node/update'; nodeId: string; patch: Partial<WorkflowNode> }
  | { type: 'node/setPosition'; nodeId: string; position: { x: number; y: number } }
  | { type: 'edge/add'; edge: Omit<WorkflowEdge, 'id'> }
  | { type: 'edge/remove'; edgeId: string }
  | { type: 'task/paramAdd'; nodeId: string; param: TaskParam }
  | {
      type: 'task/paramUpdate';
      nodeId: string;
      paramId: string;
      patch: Partial<{
        name: string;
        flag?: string;
        value: string;
        required: boolean;
        description: string;
        options: string[];
        exposeAsInput: boolean;
        exposeAsOutput: boolean;
      }>;
    }
  | { type: 'task/paramRemove'; nodeId: string; paramId: string }
  | { type: 'task/envVarAdd'; nodeId: string; variable: EnvVar }
  | {
      type: 'task/envVarUpdate';
      nodeId: string;
      varId: string;
      patch: Partial<{ key: string; value: string }>;
    }
  | { type: 'task/envVarRemove'; nodeId: string; varId: string }
  | { type: 'task/moduleAdd'; nodeId: string; moduleName: string }
  | { type: 'task/moduleUpdate'; nodeId: string; index: number; moduleName: string }
  | { type: 'task/moduleRemove'; nodeId: string; index: number }
  | { type: 'task/libraryAdd'; nodeId: string; library: string }
  | { type: 'task/libraryUpdate'; nodeId: string; index: number; library: string }
  | { type: 'task/libraryRemove'; nodeId: string; index: number }
  | { type: 'workflow/replace'; workflow: Workflow }
  | { type: 'node/remove'; nodeId: string }
  | { type: 'node/addPresetNode'; node: WorkflowNode }
  | { type: 'workflow/setBackend'; backend: 'local' | 'slurm' | 'pbs' }
  | { type: 'workflow/groupSelection' }
  | { type: 'navigation/openSubworkflow'; nodeId: string }
  | { type: 'navigation/goBack' }
  | { type: 'navigation/goToRoot' }
  | { type: 'workflow/ungroupSelectedSubworkflow' }
  | { type: 'history/undo' }
  | { type: 'history/redo' }
  | { type: 'node/removeMany'; nodeIds: string[] }
  | { type: 'node/addMany'; nodes: WorkflowNode[] };

/**
 * @brief Main reducer function for workflow state updates.
 */
export function reducer(state: State, action: Action): State {
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
            backend: state.workflow.run?.backend || 'local',
          },
        },
      };
    }

    case 'workflow/setBackend': {
      return {
        ...state,
        workflow: {
          ...state.workflow,
          run: {
            ...state.workflow.run,
            backend: action.backend,
          },
        },
      };
    }

    case 'selection/setSingleNode': {
      return {
        ...state,
        selectedNodeIds: action.nodeId ? [action.nodeId] : [],
        selectedEdgeId: null,
      };
    }

    case 'selection/toggleNode': {
      const exists = state.selectedNodeIds.includes(action.nodeId);

      return {
        ...state,
        selectedNodeIds: exists
          ? state.selectedNodeIds.filter((id) => id !== action.nodeId)
          : [...state.selectedNodeIds, action.nodeId],
        selectedEdgeId: null,
      };
    }

    case 'selection/setNodes': {
      return {
        ...state,
        selectedNodeIds: action.nodeIds,
        selectedEdgeId: null,
      };
    }

    case 'selection/clearNodes': {
      return {
        ...state,
        selectedNodeIds: [],
      };
    }

    case 'selection/setEdge': {
      return {
        ...state,
        selectedEdgeId: action.edgeId,
        selectedNodeIds: [],
      };
    }

    case 'node/addTask': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);

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
          batch: { array: { enabled: false } },
        },
      };

      const nodeSynced = syncPortsForTask(node);

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [id]: nodeSynced,
        },
      };

      return {
        ...state,
        selectedNodeIds: [id],
        selectedEdgeId: null,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'node/update': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const existing = activeWorkflow.nodes[action.nodeId];
      if (!existing) return state;

      const updated = { ...existing, ...action.patch } as WorkflowNode;

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [action.nodeId]: updated,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'node/setPosition': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const existing = activeWorkflow.nodes[action.nodeId];
      if (!existing) return state;

      const updated = { ...existing, position: action.position } as WorkflowNode;

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [action.nodeId]: updated,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'edge/add': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);

      const exists = Object.values(activeWorkflow.edges).some(
        (e) =>
          e.source === action.edge.source &&
          e.target === action.edge.target &&
          e.sourceHandle === action.edge.sourceHandle &&
          e.targetHandle === action.edge.targetHandle
      );

      if (exists) return state;

      const id = uid('edge');
      const edge: WorkflowEdge = { id, ...action.edge };

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        edges: {
          ...activeWorkflow.edges,
          [id]: edge,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'edge/remove': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);

      const { [action.edgeId]: _, ...rest } = activeWorkflow.edges;

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        edges: rest,
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
        selectedEdgeId:
          state.selectedEdgeId === action.edgeId ? null : state.selectedEdgeId,
      };
    }

    case 'task/paramAdd': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          params: [...node.task.params, action.param],
        },
      };

      const synced = syncPortsForTask(updated as TaskNode);
      const nodes = { ...activeWorkflow.nodes, [action.nodeId]: synced };

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes,
        edges: removeEdgesWithMissingPorts(activeWorkflow.edges, nodes),
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'task/paramUpdate': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const params = node.task.params.map((p) =>
        p.id === action.paramId ? { ...p, ...action.patch } : p
      );

      const updated: WorkflowNode = {
        ...node,
        task: { ...node.task, params },
      };

      const synced = syncPortsForTask(updated as TaskNode);
      const nodes = { ...activeWorkflow.nodes, [action.nodeId]: synced };

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes,
        edges: removeEdgesWithMissingPorts(activeWorkflow.edges, nodes),
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'task/paramRemove': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const params = node.task.params.filter((p) => p.id !== action.paramId);

      const updated: WorkflowNode = {
        ...node,
        task: { ...node.task, params },
      };

      const synced = syncPortsForTask(updated as TaskNode);
      const nodes = { ...activeWorkflow.nodes, [action.nodeId]: synced };

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes,
        edges: removeEdgesWithMissingPorts(activeWorkflow.edges, nodes),
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'task/envVarAdd': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];
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

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [action.nodeId]: updated,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'task/envVarUpdate': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];
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

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [action.nodeId]: updated,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'task/envVarRemove': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const variables = node.task.environment.variables.filter(
        (v) => v.id !== action.varId
      );

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          environment: { ...node.task.environment, variables },
        },
      };

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [action.nodeId]: updated,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'task/moduleAdd': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];
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

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [action.nodeId]: updated,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'task/moduleUpdate': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];
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

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [action.nodeId]: updated,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'task/moduleRemove': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const modules = node.task.environment.modules.filter(
        (_, i) => i !== action.index
      );

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          environment: { ...node.task.environment, modules },
        },
      };

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [action.nodeId]: updated,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'task/libraryAdd': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];
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

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [action.nodeId]: updated,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'task/libraryUpdate': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];
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

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [action.nodeId]: updated,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'task/libraryRemove': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];
      if (!node || node.type !== 'task') return state;

      const libraries = node.task.environment.libraries.filter(
        (_, i) => i !== action.index
      );

      const updated: WorkflowNode = {
        ...node,
        task: {
          ...node.task,
          environment: { ...node.task.environment, libraries },
        },
      };

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [action.nodeId]: updated,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'workflow/replace': {
      return {
        ...state,
        workflow: action.workflow,
        activePath: [],
        selectedNodeIds: [],
        selectedEdgeId: null,
      };
    }

    case 'node/remove': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);

      const { [action.nodeId]: _, ...restNodes } = activeWorkflow.nodes;

      const restEdges: typeof activeWorkflow.edges = {};
      for (const [eid, e] of Object.entries(activeWorkflow.edges)) {
        if (e.source === action.nodeId) continue;
        if (e.target === action.nodeId) continue;
        restEdges[eid] = e;
      }

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: restNodes,
        edges: restEdges,
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
        selectedNodeIds: state.selectedNodeIds.filter((id) => id !== action.nodeId),
        selectedEdgeId: null,
      };
    }

    case 'node/addPresetNode': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: {
          ...activeWorkflow.nodes,
          [action.node.id]: action.node,
        },
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
      };
    }

    case 'workflow/groupSelection': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const selectedIds = state.selectedNodeIds;

      if (selectedIds.length < 2) {
        return state;
      }

      const selectedNodes = selectedIds
        .map((id) => activeWorkflow.nodes[id])
        .filter(Boolean);

      const taskOnly = selectedNodes.every((n) => n.type === 'task');
      if (!taskOnly) {
        return state;
      }

      const result = createSubworkflowFromSelection(activeWorkflow, selectedIds);

      if (!result.createdNodeId) {
        return state;
      }

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          result.workflow
        ),
        selectedNodeIds: [result.createdNodeId],
        selectedEdgeId: null,
      };
    }

    case 'navigation/openSubworkflow': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
      const node = activeWorkflow.nodes[action.nodeId];

      if (!node || node.type !== 'subworkflow') {
        return state;
      }

      return {
        ...state,
        activePath: [...state.activePath, action.nodeId],
        selectedNodeIds: [],
        selectedEdgeId: null,
      };
    }

    case 'navigation/goBack': {
      if (state.activePath.length === 0) return state;

      return {
        ...state,
        activePath: state.activePath.slice(0, -1),
        selectedNodeIds: [],
        selectedEdgeId: null,
      };
    }

    case 'navigation/goToRoot': {
      return {
        ...state,
        activePath: [],
        selectedNodeIds: [],
        selectedEdgeId: null,
      };
    }

    case 'workflow/ungroupSelectedSubworkflow': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);

      if (state.selectedNodeIds.length !== 1) {
        return state;
      }

      const selectedNodeId = state.selectedNodeIds[0];
      const selectedNode = activeWorkflow.nodes[selectedNodeId];

      if (!selectedNode || selectedNode.type !== 'subworkflow') {
        return state;
      }

      const result = ungroupSubworkflowNode(activeWorkflow, selectedNodeId);

      if (result.restoredNodeIds.length === 0) {
        return state;
      }

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          result.workflow
        ),
        selectedNodeIds: result.restoredNodeIds,
        selectedEdgeId: null,
      };
    }

    case 'node/removeMany': {
      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);

      if (action.nodeIds.length === 0) {
        return state;
      }

      const idsToRemove = new Set(action.nodeIds);

      const restNodes: typeof activeWorkflow.nodes = {};
      for (const [nodeId, node] of Object.entries(activeWorkflow.nodes)) {
        if (!idsToRemove.has(nodeId)) {
          restNodes[nodeId] = node;
        }
      }

      const restEdges: typeof activeWorkflow.edges = {};
      for (const [edgeId, edge] of Object.entries(activeWorkflow.edges)) {
        if (idsToRemove.has(edge.source)) continue;
        if (idsToRemove.has(edge.target)) continue;
        restEdges[edgeId] = edge;
      }

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: restNodes,
        edges: restEdges,
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
        selectedNodeIds: state.selectedNodeIds.filter((id) => !idsToRemove.has(id)),
        selectedEdgeId: null,
      };
    }

    case 'node/addMany': {
      if (action.nodes.length === 0) return state;

      const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);

      const newNodes = { ...activeWorkflow.nodes };
      for (const node of action.nodes) {
        newNodes[node.id] = node;
      }

      const updatedActiveWorkflow: Workflow = {
        ...activeWorkflow,
        nodes: newNodes,
      };

      return {
        ...state,
        workflow: updateWorkflowAtPath(
          state.workflow,
          state.activePath,
          updatedActiveWorkflow
        ),
        selectedNodeIds: action.nodes.map((n) => n.id),
        selectedEdgeId: null,
      };
    }

    default:
      return state;
  }
}