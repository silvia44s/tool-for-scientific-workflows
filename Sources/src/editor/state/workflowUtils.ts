/**
 * @file workflowUtils.ts
 * @brief Utility functions for managing workflow state.
 * @author Silvia Šlachtovská
 * 
 */

import type { Workflow, WorkflowNode } from './model';

/**
 * @brief Generates a simple unique ID.
 *
 * Used for creating node, edge and workflow identifiers.
 */
export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * @brief Creates an empty workflow object.
 *
 * This is used when the application starts or when
 * a new workflow is created.
 */
export function createInitialWorkflow(): Workflow {
  return {
    schemaVersion: 1,
    id: uid('wf'),
    name: 'My Workflow',
    canvas: { viewport: { x: 0, y: 0, zoom: 1 } },
    nodes: {},
    edges: {},
    run: {
      backend: 'local',
      resultsRoot: '',
    },
  };
}

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