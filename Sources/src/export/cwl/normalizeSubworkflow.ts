/**
 * @file normalizeSubworkflow.ts
 * @brief Normalizes a subworkflow node into an intermediate CWL workflow representation.
 *
 * This file transforms a subworkflow node from the internal workflow model into
 * a normalized CWL Workflow document. It resolves public subworkflow inputs and outputs,
 * internal task steps, boundary mappings and generated child files required for export.
 */

import type {
  SubworkflowNode,
} from '../../domain/workflow/model/model';
import type {
  WorkflowNormalizationResult,
  WorkflowStepInfo,
  NormalizedWorkflowDoc,
  NormalizedWorkflowInput,
  NormalizedWorkflowOutput,
  NormalizedWorkflowStep,
} from './types';
import { normalizeTaskNode } from './normalizeTask';
import { error } from './diagnostics';
import {
  findNodeById,
  findNodeInputPort,
  findNodeOutputPort,
  makeSubworkflowInputId,
  makeSubworkflowOutputId,
  slugify,
  toCwlPortType,
  uniqueName,
  topologicallyOrderNodeIds,
} from './utils';

/**
 * @brief Normalizes a subworkflow node into a CWL workflow document and related files.
 *
 * The normalization process converts internal task nodes into workflow steps,
 * resolves internal edge connections, maps public boundary ports to workflow inputs
 * and outputs, and collects diagnostics for unsupported or inconsistent references.
 *
 * @param node Subworkflow node to normalize.
 * @param subworkflowFilePath Target file path of the generated subworkflow CWL document.
 * @return Normalized workflow result containing the generated subworkflow document,
 *         child files and collected diagnostics.
 */
export function normalizeSubworkflowNode(
  node: SubworkflowNode,
  subworkflowFilePath: string
): WorkflowNormalizationResult {
  const diagnostics = [];
  const files: WorkflowNormalizationResult['files'] = [];
  const stepInfos = new Map<string, WorkflowStepInfo>();
  const stepUsed = new Set<string>();

  const internalWorkflow = node.subworkflow.workflow;
  const orderedInternalNodeIds = topologicallyOrderNodeIds(internalWorkflow);

  // 1. normalize internal nodes
  for (const internalNodeId of orderedInternalNodeIds) {
    const internalNode = internalWorkflow.nodes[internalNodeId];
    if (!internalNode) continue;
    const stepId = uniqueName(
      slugify(internalNode.name || internalNode.id, internalNode.id),
      stepUsed
    );

    if (internalNode.type === 'task') {
      const runPath = `../tools/${stepId}.cwl`;
      const taskNorm = normalizeTaskNode(internalNode);
      diagnostics.push(...taskNorm.diagnostics);

      files.push({
        path: `tools/${stepId}.cwl`,
        doc: taskNorm.tool,
      });

      stepInfos.set(internalNode.id, {
        nodeId: internalNode.id,
        stepId,
        runPath,
        inputPortIdToInputId: taskNorm.inputPortIdToInputId,
        outputPortIdToOutputId: taskNorm.outputPortIdToOutputId,
      });
    } else {
      diagnostics.push(
        error('Nested subworkflows deeper than one level are not implemented yet.', {
          nodeId: internalNode.id,
        })
      );
    }
  }

  // 2. build internal edge lookup
  const incomingByTargetPort = new Map<string, { sourceNodeId: string; sourcePortId: string }>();

  for (const edge of Object.values(internalWorkflow.edges)) {
    if (!edge.sourceHandle || !edge.targetHandle) continue;

    const srcNode = internalWorkflow.nodes[edge.source];
    const dstNode = internalWorkflow.nodes[edge.target];

    if (!srcNode) {
      diagnostics.push(
        error(`Internal edge references missing source node '${edge.source}'.`)
      );
      continue;
    }

    if (!dstNode) {
      diagnostics.push(
        error(`Internal edge references missing target node '${edge.target}'.`)
      );
      continue;
    }

    const srcPort = findNodeOutputPort(srcNode, edge.sourceHandle);
    if (!srcPort) {
      diagnostics.push(
        error(
          `Internal edge references missing source output port '${edge.sourceHandle}'.`,
          { nodeId: edge.source, portId: edge.sourceHandle }
        )
      );
      continue;
    }

    const dstPort = findNodeInputPort(dstNode, edge.targetHandle);
    if (!dstPort) {
      diagnostics.push(
        error(
          `Internal edge references missing target input port '${edge.targetHandle}'.`,
          { nodeId: edge.target, portId: edge.targetHandle }
        )
      );
      continue;
    }

    incomingByTargetPort.set(`${edge.target}:${edge.targetHandle}`, {
      sourceNodeId: edge.source,
      sourcePortId: edge.sourceHandle,
    });
  }

  // 3. subworkflow public inputs from subworkflow.io.inputs
  const workflowInputs: NormalizedWorkflowInput[] = [];
  const workflowInputMap = new Map<string, string>(); // external portId -> cwl input id
  const usedWorkflowInputs = new Set<string>();

  for (const port of node.subworkflow.io.inputs) {
    const inputId = uniqueName(
      makeSubworkflowInputId(port.name || port.id, port.id),
      usedWorkflowInputs
    );

    workflowInputMap.set(port.id, inputId);
    workflowInputs.push({
      id: inputId,
      type: toCwlPortType(port.dataType),
    });
  }

  // 4. prepare boundary lookup for external input mapping
  const boundaryInputByInternalPort = new Map<
    string,
    { subInputPortId: string }
  >();

  for (const b of node.subworkflow.boundary.inputs) {
    const targetNode = findNodeById(internalWorkflow.nodes, b.targetNodeId);
    if (!targetNode) {
      diagnostics.push(
        error(`Boundary input references missing internal node '${b.targetNodeId}'.`, {
          nodeId: b.targetNodeId,
          portId: b.targetPortId,
        })
      );
      continue;
    }

    const targetPort = findNodeInputPort(targetNode, b.targetPortId);
    if (!targetPort) {
      diagnostics.push(
        error(
          `Boundary input references missing internal input port '${b.targetPortId}'.`,
          { nodeId: b.targetNodeId, portId: b.targetPortId }
        )
      );
      continue;
    }

    const publicPort = node.subworkflow.io.inputs.find(p => p.id === b.portId);
    if (!publicPort) {
      diagnostics.push(
        error(`Boundary input references missing public subworkflow input '${b.portId}'.`, {
          nodeId: node.id,
          portId: b.portId,
        })
      );
      continue;
    }

    boundaryInputByInternalPort.set(`${b.targetNodeId}:${b.targetPortId}`, {
      subInputPortId: b.portId,
    });
  }

  // 5. internal steps
  const steps: NormalizedWorkflowStep[] = [];

  for (const internalNodeId of orderedInternalNodeIds) {
    const internalNode = internalWorkflow.nodes[internalNodeId];
    if (!internalNode) continue;
    if (internalNode.type !== 'task') continue;

    const step = stepInfos.get(internalNode.id);
    if (!step) continue;

    const stepInputs: NormalizedWorkflowStep['in'] = [];

    for (const port of internalNode.task.io.inputs) {
      const stepInputId = step.inputPortIdToInputId.get(port.id);
      if (!stepInputId) continue;

      // A. regular internal edge
      const incoming = incomingByTargetPort.get(`${internalNode.id}:${port.id}`);
      if (incoming) {
        const srcStep = stepInfos.get(incoming.sourceNodeId);
        const srcOut = srcStep?.outputPortIdToOutputId.get(incoming.sourcePortId);

        if (!srcStep || !srcOut) {
          diagnostics.push(
            error(
              `Internal edge into '${internalNode.id}:${port.id}' references unresolved source port.`,
              { nodeId: internalNode.id, portId: port.id }
            )
          );
          continue;
        }

        stepInputs.push({
          id: stepInputId,
          source: `${srcStep.stepId}/${srcOut}`,
        });
        continue;
      }

      // B. boundary input
      const boundary = boundaryInputByInternalPort.get(`${internalNode.id}:${port.id}`);
      if (boundary) {
        const subInputId = workflowInputMap.get(boundary.subInputPortId);
        if (!subInputId) {
          diagnostics.push(
            error(
              `Boundary input for '${internalNode.id}:${port.id}' could not be resolved.`,
              { nodeId: internalNode.id, portId: port.id }
            )
          );
          continue;
        }

        stepInputs.push({
          id: stepInputId,
          source: subInputId,
        });
      }
    }

    const stepOutputs: string[] = [];
    for (const port of internalNode.task.io.outputs) {
      const outId = step.outputPortIdToOutputId.get(port.id);
      if (outId) {
        stepOutputs.push(outId);
      }
    }

    steps.push({
      id: step.stepId,
      run: step.runPath,
      in: stepInputs,
      out: stepOutputs,
    });
  }

  // 6. public outputs from boundary.outputs
  const outputs: NormalizedWorkflowOutput[] = [];
  const usedWorkflowOutputs = new Set<string>();

  for (const b of node.subworkflow.boundary.outputs) {
    const sourceNode = findNodeById(internalWorkflow.nodes, b.sourceNodeId);
    if (!sourceNode) {
      diagnostics.push(
        error(`Boundary output references missing internal node '${b.sourceNodeId}'.`, {
          nodeId: b.sourceNodeId,
          portId: b.sourcePortId,
        })
      );
      continue;
    }

    const sourcePort = findNodeOutputPort(sourceNode, b.sourcePortId);
    if (!sourcePort) {
      diagnostics.push(
        error(
          `Boundary output references missing internal output port '${b.sourcePortId}'.`,
          { nodeId: b.sourceNodeId, portId: b.sourcePortId }
        )
      );
      continue;
    }

    const publicPort = node.subworkflow.io.outputs.find(p => p.id === b.portId);
    if (!publicPort) {
      diagnostics.push(
        error(`Boundary output references missing public subworkflow output '${b.portId}'.`, {
          nodeId: node.id,
          portId: b.portId,
        })
      );
      continue;
    }

    const step = stepInfos.get(b.sourceNodeId);
    const outId = step?.outputPortIdToOutputId.get(b.sourcePortId);

    if (!step || !outId) {
      diagnostics.push(
        error(
          `Boundary output for '${b.sourceNodeId}:${b.sourcePortId}' could not be resolved.`,
          { nodeId: b.sourceNodeId, portId: b.sourcePortId }
        )
      );
      continue;
    }

    const wfOutId = uniqueName(
      makeSubworkflowOutputId(publicPort.name || publicPort.id, publicPort.id),
      usedWorkflowOutputs
    );

    outputs.push({
      id: wfOutId,
      type: toCwlPortType(publicPort.dataType),
      outputSource: `${step.stepId}/${outId}`,
    });
  }

  const workflowDoc: NormalizedWorkflowDoc = {
    kind: 'Workflow',
    label: node.name,
    requirements: {
      subworkflowFeature: false,
    },
    inputs: workflowInputs,
    steps,
    outputs,
  };

  files.push({
    path: subworkflowFilePath,
    doc: workflowDoc,
  });

  return {
    workflowDoc,
    files,
    diagnostics,
  };
}