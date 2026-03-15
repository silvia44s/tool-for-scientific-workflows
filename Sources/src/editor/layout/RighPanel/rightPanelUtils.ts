/**
 * @file rightPanelUtils.ts
 * @brief Utility functions for the right panel components.
 * @author Silvia Šlachtovská
 * 
 */

import type { TaskParam, Workflow, WorkflowNode } from '../../state/model';
import { uid as sharedUid } from '../../state/workflowUtils';

export function uid(prefix: string) {
  return sharedUid(prefix);
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

export function getParamRole(p: TaskParam): 'local' | 'input' | 'output' {
  if (p.exposeAsInput) return 'input';
  if (p.exposeAsOutput) return 'output';
  return 'local';
}

export function isInputConnected(
  nodeId: string,
  paramId: string,
  workflow: Workflow
): boolean {
  const node = workflow.nodes[nodeId];
  if (!node || node.type !== 'task') return false;

  const inputPort = node.task.io.inputs.find(
    (port) => port.inputBind?.kind === 'param' && port.inputBind.paramId === paramId
  );

  if (!inputPort) return false;

  return Object.values(workflow.edges).some(
    (e) => e.target === nodeId && e.targetHandle === inputPort.id
  );
}

export function getParamDisplayValue(
  nodeId: string,
  p: TaskParam,
  workflow: Workflow
): string {
  const role = getParamRole(p);

  if (role === 'input') {
    const connected = isInputConnected(nodeId, p.id, workflow);
    if (connected) return 'connected';
    if (p.value?.trim()) return p.value;
    return 'empty';
  }

  if (role === 'output') {
    return p.value?.trim() || 'auto path / empty';
  }

  if (p.kind === 'bool') {
    return p.value === 'false' ? 'false' : 'true';
  }

  return p.value?.trim() || 'empty';
}

export function findInnerNodeName(
  node: Extract<WorkflowNode, { type: 'subworkflow' }>,
  innerNodeId: string
): string {
  return node.subworkflow.workflow.nodes[innerNodeId]?.name ?? innerNodeId;
}

export function findSubworkflowPortName(
  node: Extract<WorkflowNode, { type: 'subworkflow' }>,
  portId: string,
  direction: 'input' | 'output'
): string {
  const ports =
    direction === 'input'
      ? node.subworkflow.io.inputs
      : node.subworkflow.io.outputs;

  return ports.find((p) => p.id === portId)?.name ?? portId;
}