/**
 * @file workflowReducer.task.ts
 * @brief Handles task-specific state transitions in the workflow reducer.
 * @author Silvia Šlachtovská
 *
 * This file contains reducer logic for modifying task node configuration,
 * including parameters, environment variables, loaded modules, and libraries.
 * All operations are applied to task nodes in the currently active workflow.
 */

import type { Action } from '../model/actions';
import type { State } from './workflowReducer';
import { updateTaskNode } from './workflowReducer.helpers';
import {
  addEnvVar,
  addLibrary,
  addModule,
  addTaskParam,
  removeEnvVar,
  removeLibrary,
  removeModule,
  removeTaskParam,
  updateEnvVar,
  updateLibrary,
  updateModule,
  updateTaskParam,
} from '../operations/taskOperations';

/**
 * @brief Applies task-related actions to the workflow reducer state.
 *
 * Supports creation, update, and removal of task parameters, environment variables,
 * module entries, and library entries. All changes are delegated to domain-level
 * task operations through a shared task-node update helper.
 *
 * @param state Current reducer state.
 * @param action Action to apply.
 * @return Updated state if the action is handled, otherwise null.
 */
export function handleTaskAction(state: State, action: Action): State | null {
  switch (action.type) {
    case 'task/paramAdd':
      return updateTaskNode(state, action.nodeId, (node, activeWorkflow) =>
        addTaskParam(node, activeWorkflow, action.param)
      );

    case 'task/paramUpdate':
      return updateTaskNode(state, action.nodeId, (node, activeWorkflow) =>
        updateTaskParam(node, activeWorkflow, action.paramId, action.patch)
      );

    case 'task/paramRemove':
      return updateTaskNode(state, action.nodeId, (node, activeWorkflow) =>
        removeTaskParam(node, activeWorkflow, action.paramId)
      );

    case 'task/envVarAdd':
      return updateTaskNode(state, action.nodeId, (node) =>
        addEnvVar(node, action.variable)
      );

    case 'task/envVarUpdate':
      return updateTaskNode(state, action.nodeId, (node) =>
        updateEnvVar(node, action.varId, action.patch)
      );

    case 'task/envVarRemove':
      return updateTaskNode(state, action.nodeId, (node) =>
        removeEnvVar(node, action.varId)
      );

    case 'task/moduleAdd':
      return updateTaskNode(state, action.nodeId, (node) =>
        addModule(node, action.moduleName)
      );

    case 'task/moduleUpdate':
      return updateTaskNode(state, action.nodeId, (node) =>
        updateModule(node, action.index, action.moduleName)
      );

    case 'task/moduleRemove':
      return updateTaskNode(state, action.nodeId, (node) =>
        removeModule(node, action.index)
      );

    case 'task/libraryAdd':
      return updateTaskNode(state, action.nodeId, (node) =>
        addLibrary(node, action.library)
      );

    case 'task/libraryUpdate':
      return updateTaskNode(state, action.nodeId, (node) =>
        updateLibrary(node, action.index, action.library)
      );

    case 'task/libraryRemove':
      return updateTaskNode(state, action.nodeId, (node) =>
        removeLibrary(node, action.index)
      );

    default:
      return null;
  }
}