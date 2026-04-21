/**
 * @file taskOperations.ts
 * @brief Domain operations for modifying task node configuration.
 * @author Silvia Šlachtovská
 *
 * This file contains pure functions for updating task-specific data,
 * including parameters, environment variables, loaded modules, and libraries.
 * Some operations also resynchronize task ports and remove invalid edges
 * when parameter changes affect exposed inputs or outputs.
 */

import type { TaskNode, Workflow } from '../model/model';
import {
  removeEdgesWithMissingPorts,
  syncPortsForTask,
} from './taskPorts';
import type { Action } from '../model/actions';

/**
 * @brief Result of a task node update operation.
 *
 * Contains the updated task node and optionally an updated edge collection
 * when the modification affects exposed ports and may invalidate connections.
 */
type TaskUpdateResult = {
  node: TaskNode;
  edges?: Workflow['edges'];
};

/**
 * @brief Adds a new parameter to a task node.
 *
 * After inserting the parameter, task ports are resynchronized and
 * edges referencing removed or changed ports are filtered out.
 *
 * @param node Task node to update.
 * @param activeWorkflow Active workflow containing the task node.
 * @param param Parameter to add.
 * @return Updated task node and optionally updated workflow edges.
 */
export function addTaskParam(
  node: TaskNode,
  activeWorkflow: Workflow,
  param: Extract<Action, { type: 'task/paramAdd' }>['param']
): TaskUpdateResult {
  const updatedNode: TaskNode = {
    ...node,
    task: {
      ...node.task,
      params: [...node.task.params, param],
    },
  };

  const syncedNode = syncPortsForTask(updatedNode);
  const nodes = {
    ...activeWorkflow.nodes,
    [node.id]: syncedNode,
  };

  return {
    node: syncedNode,
    edges: removeEdgesWithMissingPorts(activeWorkflow.edges, nodes),
  };
}

/**
 * @brief Updates an existing task parameter.
 *
 * After applying the patch, task ports are resynchronized and
 * edges referencing invalid ports are removed.
 *
 * @param node Task node to update.
 * @param activeWorkflow Active workflow containing the task node.
 * @param paramId Identifier of the parameter to update.
 * @param patch Partial parameter data to merge into the existing parameter.
 * @return Updated task node and optionally updated workflow edges.
 */
export function updateTaskParam(
  node: TaskNode,
  activeWorkflow: Workflow,
  paramId: string,
  patch: Extract<Action, { type: 'task/paramUpdate' }>['patch']
): TaskUpdateResult {
  const params = node.task.params.map((p) =>
    p.id === paramId ? { ...p, ...patch } : p
  );

  const updatedNode: TaskNode = {
    ...node,
    task: {
      ...node.task,
      params,
    },
  };

  const syncedNode = syncPortsForTask(updatedNode);
  const nodes = {
    ...activeWorkflow.nodes,
    [node.id]: syncedNode,
  };

  return {
    node: syncedNode,
    edges: removeEdgesWithMissingPorts(activeWorkflow.edges, nodes),
  };
}

/**
 * @brief Removes a parameter from a task node.
 *
 * After removal, task ports are resynchronized and
 * edges referencing no longer existing ports are removed.
 *
 * @param node Task node to update.
 * @param activeWorkflow Active workflow containing the task node.
 * @param paramId Identifier of the parameter to remove.
 * @return Updated task node and optionally updated workflow edges.
 */
export function removeTaskParam(
  node: TaskNode,
  activeWorkflow: Workflow,
  paramId: string
): TaskUpdateResult {
  const params = node.task.params.filter((p) => p.id !== paramId);

  const updatedNode: TaskNode = {
    ...node,
    task: {
      ...node.task,
      params,
    },
  };

  const syncedNode = syncPortsForTask(updatedNode);
  const nodes = {
    ...activeWorkflow.nodes,
    [node.id]: syncedNode,
  };

  return {
    node: syncedNode,
    edges: removeEdgesWithMissingPorts(activeWorkflow.edges, nodes),
  };
}

/**
 * @brief Adds an environment variable to a task node.
 *
 * @param node Task node to update.
 * @param variable Environment variable to add.
 * @return Updated task node.
 */
export function addEnvVar(
  node: TaskNode,
  variable: Extract<Action, { type: 'task/envVarAdd' }>['variable']
): TaskUpdateResult {
  return {
    node: {
      ...node,
      task: {
        ...node.task,
        environment: {
          ...node.task.environment,
          variables: [...node.task.environment.variables, variable],
        },
      },
    },
  };
}

/**
 * @brief Updates an existing environment variable on a task node.
 *
 * @param node Task node to update.
 * @param varId Identifier of the environment variable to update.
 * @param patch Partial variable data to merge into the existing variable.
 * @return Updated task node.
 */
export function updateEnvVar(
  node: TaskNode,
  varId: string,
  patch: Extract<Action, { type: 'task/envVarUpdate' }>['patch']
): TaskUpdateResult {
  return {
    node: {
      ...node,
      task: {
        ...node.task,
        environment: {
          ...node.task.environment,
          variables: node.task.environment.variables.map((v) =>
            v.id === varId ? { ...v, ...patch } : v
          ),
        },
      },
    },
  };
}

/**
 * @brief Removes an environment variable from a task node.
 *
 * @param node Task node to update.
 * @param varId Identifier of the variable to remove.
 * @return Updated task node.
 */
export function removeEnvVar(
  node: TaskNode,
  varId: string
): TaskUpdateResult {
  return {
    node: {
      ...node,
      task: {
        ...node.task,
        environment: {
          ...node.task.environment,
          variables: node.task.environment.variables.filter(
            (v) => v.id !== varId
          ),
        },
      },
    },
  };
}

/**
 * @brief Adds a module entry to a task node.
 *
 * @param node Task node to update.
 * @param moduleName Module name to add.
 * @return Updated task node.
 */
export function addModule(
  node: TaskNode,
  moduleName: string
): TaskUpdateResult {
  return {
    node: {
      ...node,
      task: {
        ...node.task,
        environment: {
          ...node.task.environment,
          modules: [...node.task.environment.modules, moduleName],
        },
      },
    },
  };
}

/**
 * @brief Updates one module entry of a task node.
 *
 * @param node Task node to update.
 * @param index Index of the module entry to update.
 * @param moduleName New module name.
 * @return Updated task node.
 */
export function updateModule(
  node: TaskNode,
  index: number,
  moduleName: string
): TaskUpdateResult {
  return {
    node: {
      ...node,
      task: {
        ...node.task,
        environment: {
          ...node.task.environment,
          modules: node.task.environment.modules.map((value, i) =>
            i === index ? moduleName : value
          ),
        },
      },
    },
  };
}

/**
 * @brief Removes one module entry from a task node.
 *
 * @param node Task node to update.
 * @param index Index of the module entry to remove.
 * @return Updated task node.
 */
export function removeModule(
  node: TaskNode,
  index: number
): TaskUpdateResult {
  return {
    node: {
      ...node,
      task: {
        ...node.task,
        environment: {
          ...node.task.environment,
          modules: node.task.environment.modules.filter((_, i) => i !== index),
        },
      },
    },
  };
}

/**
 * @brief Adds a library entry to a task node.
 *
 * @param node Task node to update.
 * @param library Library path or identifier to add.
 * @return Updated task node.
 */
export function addLibrary(
  node: TaskNode,
  library: string
): TaskUpdateResult {
  return {
    node: {
      ...node,
      task: {
        ...node.task,
        environment: {
          ...node.task.environment,
          libraries: [...node.task.environment.libraries, library],
        },
      },
    },
  };
}

/**
 * @brief Updates one library entry of a task node.
 *
 * @param node Task node to update.
 * @param index Index of the library entry to update.
 * @param library New library value.
 * @return Updated task node.
 */
export function updateLibrary(
  node: TaskNode,
  index: number,
  library: string
): TaskUpdateResult {
  return {
    node: {
      ...node,
      task: {
        ...node.task,
        environment: {
          ...node.task.environment,
          libraries: node.task.environment.libraries.map((value, i) =>
            i === index ? library : value
          ),
        },
      },
    },
  };
}

/**
 * @brief Removes one library entry from a task node.
 *
 * @param node Task node to update.
 * @param index Index of the library entry to remove.
 * @return Updated task node.
 */
export function removeLibrary(
  node: TaskNode,
  index: number
): TaskUpdateResult {
  return {
    node: {
      ...node,
      task: {
        ...node.task,
        environment: {
          ...node.task.environment,
          libraries: node.task.environment.libraries.filter((_, i) => i !== index),
        },
      },
    },
  };
}