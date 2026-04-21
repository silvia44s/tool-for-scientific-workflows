/**
 * @file actions.ts
 * @brief Defines action types used to update workflow editor state.
 * @author Silvia Šlachtovská
 *
 * This file contains the discriminated union of all actions that can be
 * dispatched to the workflow reducer. The actions cover workflow metadata,
 * node and edge manipulation, task configuration, selection handling,
 * navigation in nested workflows, and history operations.
 */

import type {
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  TaskParam,
  EnvVar,
} from './model';

/**
 * @brief Union type of all reducer actions supported by the workflow editor.
 *
 * Each action represents one state transition that can be applied to the
 * workflow editor state, such as adding nodes, updating task parameters,
 * changing selection, or navigating into a subworkflow.
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
 * @brief Extended action type used by the history-aware reducer.
 *
 * In addition to standard workflow actions, this type includes a special
 * action for marking the current state as saved.
 */
export type HistoryAction = Action | { type: 'history/markSaved' };