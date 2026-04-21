/**
 * @file rightPanelUtils.ts
 * @brief Utility functions used by the right panel components.
 * @author Silvia Šlachtovská
 */

import type {
  TaskParam,
  Workflow,
  WorkflowNode,
} from '../../../../domain/workflow/model/model';
import { uid as sharedUid } from '../../../../domain/workflow/operations/workflowTree';

/**
 * @brief Generates a unique identifier with the given prefix.
 *
 * @param prefix Prefix used for the generated identifier.
 * @return Generated unique identifier.
 */
export function uid(prefix: string) {
  return sharedUid(prefix);
}

/**
 * @brief Downloads the given data as a formatted JSON file.
 *
 * @param filename Name of the output file.
 * @param data Data to serialize and download.
 */
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

/**
 * @brief Returns the workflow role of a task parameter.
 *
 * @param param Task parameter.
 * @return Parameter role: local, input, or output.
 */
export function getParamRole(param: TaskParam): 'local' | 'input' | 'output' {
  if (param.exposeAsInput) return 'input';
  if (param.exposeAsOutput) return 'output';
  return 'local';
}

/**
 * @brief Checks whether an input-exposed parameter is connected by an incoming edge.
 *
 * @param nodeId Identifier of the task node.
 * @param paramId Identifier of the parameter.
 * @param workflow Active workflow.
 * @return True if the corresponding input port is connected.
 */
export function isInputConnected(
  nodeId: string,
  paramId: string,
  workflow: Workflow
): boolean {
  const node = workflow.nodes[nodeId];
  if (!node || node.type !== 'task') return false;

  const inputPort = node.task.io.inputs.find(
    (port) =>
      port.inputBind?.kind === 'param' &&
      port.inputBind.paramId === paramId
  );

  if (!inputPort) return false;

  return Object.values(workflow.edges).some(
    (edge) => edge.target === nodeId && edge.targetHandle === inputPort.id
  );
}

/**
 * @brief Returns a human-readable value description for a task parameter.
 *
 * The displayed value depends on parameter kind, role, and whether
 * the corresponding input is connected inside the workflow.
 *
 * @param nodeId Identifier of the task node.
 * @param param Task parameter.
 * @param workflow Active workflow.
 * @return Display string representing the parameter value.
 */
export function getParamDisplayValue(
  nodeId: string,
  param: TaskParam,
  workflow: Workflow
): string {
  const role = getParamRole(param);

  if (role === 'input') {
    const connected = isInputConnected(nodeId, param.id, workflow);
    if (connected) return 'connected';
    if (param.value?.trim()) return param.value;
    return 'empty';
  }

  if (role === 'output') {
    return param.value?.trim() || 'auto path / empty';
  }

  if (param.kind === 'bool') {
    return param.value === 'false' ? 'false' : 'true';
  }

  return param.value?.trim() || 'empty';
}

/**
 * @brief Finds the display name of an inner node inside a subworkflow.
 *
 * @param node Subworkflow node.
 * @param innerNodeId Identifier of the inner node.
 * @return Inner node name if found, otherwise the identifier itself.
 */
export function findInnerNodeName(
  node: Extract<WorkflowNode, { type: 'subworkflow' }>,
  innerNodeId: string
): string {
  return node.subworkflow.workflow.nodes[innerNodeId]?.name ?? innerNodeId;
}

/**
 * @brief Finds the display name of a subworkflow port.
 *
 * @param node Subworkflow node.
 * @param portId Identifier of the port.
 * @param direction Port direction.
 * @return Port name if found, otherwise the identifier itself.
 */
export function findSubworkflowPortName(
  node: Extract<WorkflowNode, { type: 'subworkflow' }>,
  portId: string,
  direction: 'input' | 'output'
): string {
  const ports =
    direction === 'input'
      ? node.subworkflow.io.inputs
      : node.subworkflow.io.outputs;

  return ports.find((port) => port.id === portId)?.name ?? portId;
}