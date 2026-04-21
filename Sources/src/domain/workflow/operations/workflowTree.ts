/**
 * @file workflowTree.ts
 * @brief Utility functions for working with nested workflow structure.
 * @author Silvia Šlachtovská
 *
 * This file contains helper functions for generating identifiers,
 * creating an initial empty workflow, resolving the currently active workflow
 * in a nested hierarchy, updating workflows at a navigation path,
 * and retrieving the active subworkflow node.
 */

import type { Workflow, WorkflowNode } from '../model/model';

/**
 * @brief Generates a simple unique identifier with the given prefix.
 *
 * Used for creating workflow, node, edge, and other domain identifiers.
 *
 * @param prefix Prefix describing the identifier kind.
 * @return Generated unique identifier.
 */
export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * @brief Creates an initial empty workflow document.
 *
 * The workflow is initialized with default metadata, an empty graph,
 * default canvas viewport, and default local backend configuration.
 *
 * @return New empty workflow object.
 */
export function createInitialWorkflow(): Workflow {
  return {
    schemaVersion: 1,
    id: uid('wf'),
    name: 'workflow',
    canvas: { viewport: { x: 0, y: 0, zoom: 1 } },
    nodes: {},
    edges: {},
    run: {
      backend: 'local',
      resultsRoot: '',
    },
  };
}

/**
 * @brief Resolves the currently active workflow according to a navigation path.
 *
 * The path is interpreted as a sequence of subworkflow node identifiers.
 * If the path cannot be fully resolved, the deepest valid workflow reached
 * so far is returned.
 *
 * @param root Root workflow document.
 * @param path Navigation path through nested subworkflow nodes.
 * @return Active workflow resolved from the given path.
 */
export function getActiveWorkflow(root: Workflow, path: string[]): Workflow {
  let current = root;

  for (const nodeId of path) {
    const node = current.nodes[nodeId];
    if (!node || node.type !== 'subworkflow') {
      return current;
    }
    current = node.subworkflow.workflow;
  }

  return current;
}

/**
 * @brief Replaces a workflow subtree at the specified navigation path.
 *
 * The function recursively descends through subworkflow nodes and replaces
 * the workflow located at the target path with the provided updated workflow.
 * If the path is invalid, the original root workflow is returned unchanged.
 *
 * @param root Root workflow document.
 * @param path Navigation path to the workflow that should be replaced.
 * @param updatedWorkflow New workflow instance to store at the target path.
 * @return Updated root workflow with the replaced subtree.
 */
export function updateWorkflowAtPath(
  root: Workflow,
  path: string[],
  updatedWorkflow: Workflow
): Workflow {
  if (path.length === 0) {
    return updatedWorkflow;
  }

  const [head, ...rest] = path;
  const node = root.nodes[head];

  if (!node || node.type !== 'subworkflow') {
    return root;
  }

  const updatedNode: WorkflowNode = {
    ...node,
    subworkflow: {
      ...node.subworkflow,
      workflow: updateWorkflowAtPath(
        node.subworkflow.workflow,
        rest,
        updatedWorkflow
      ),
    },
  };

  return {
    ...root,
    nodes: {
      ...root.nodes,
      [head]: updatedNode,
    },
  };
}

/**
 * @brief Returns the currently active subworkflow node for the given path.
 *
 * If the path is empty, there is no active subworkflow and the function returns null.
 * If the path cannot be fully resolved, null is returned as well.
 *
 * @param root Root workflow document.
 * @param path Navigation path through nested subworkflow nodes.
 * @return Active subworkflow node, or null if no valid subworkflow is active.
 */
export function getActiveSubworkflowNode(
  root: Workflow,
  path: string[]
): WorkflowNode | null {
  if (path.length === 0) return null;

  let current = root;
  let currentNode: WorkflowNode | null = null;

  for (const nodeId of path) {
    currentNode = current.nodes[nodeId] ?? null;
    if (!currentNode || currentNode.type !== 'subworkflow') {
      return null;
    }
    current = currentNode.subworkflow.workflow;
  }

  return currentNode;
}