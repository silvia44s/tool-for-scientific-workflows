import type { Workflow } from '../../editor/state/model';
import type {
  WorkflowNormalizationResult,
  WorkflowStepInfo,
  NormalizedWorkflowDoc,
  NormalizedWorkflowInput,
  NormalizedWorkflowOutput,
  NormalizedWorkflowStep,
} from './types';
import { normalizeTaskNode } from './normalizeTask';
import { normalizeSubworkflowNode } from './normalizeSubworkflow';
import { error } from './diagnostics';
import {
  findNodeInputPort,
  findNodeOutputPort,
  getNodeInputPorts,
  getNodeOutputPorts,
  slugify,
  toCwlPortType,
  uniqueName,
  topologicallyOrderNodeIds
} from './utils';

export function normalizeWorkflow(workflow: Workflow): WorkflowNormalizationResult {
  const diagnostics = [];
  const files: WorkflowNormalizationResult['files'] = [];
  const stepInfos = new Map<string, WorkflowStepInfo>();
  const stepUsed = new Set<string>();

  const orderedNodeIds = topologicallyOrderNodeIds(workflow);

  // 1. normalize all top-level nodes
  for (const nodeId of orderedNodeIds) {
    const node = workflow.nodes[nodeId];
    if (!node) continue;
        const stepId = uniqueName(slugify(node.name || node.id, node.id), stepUsed);

        if (node.type === 'task') {
        const runPath = `tools/${stepId}.cwl`;

        const taskNorm = normalizeTaskNode(node);
        diagnostics.push(...taskNorm.diagnostics);

        files.push({
            path: runPath,
            doc: taskNorm.tool,
        });

        stepInfos.set(node.id, {
            nodeId: node.id,
            stepId,
            runPath,
            inputPortIdToInputId: taskNorm.inputPortIdToInputId,
            outputPortIdToOutputId: taskNorm.outputPortIdToOutputId,
        });
        } else {
        const subworkflowRunPath = `subworkflows/${stepId}.cwl`;
        const subNorm = normalizeSubworkflowNode(node, subworkflowRunPath);
        diagnostics.push(...subNorm.diagnostics);

        for (const f of subNorm.files) {
            files.push(f);
        }

        const inputPortIdToInputId = new Map<string, string>();
        const outputPortIdToOutputId = new Map<string, string>();

        const usedSubInputs = new Set<string>();
        for (const port of node.subworkflow.io.inputs) {
            const inputId = uniqueName(
            slugify((port.name || port.id).replace(/^--/, ''), port.id),
            usedSubInputs
            );
            inputPortIdToInputId.set(port.id, inputId);
        }

        const usedSubOutputs = new Set<string>();
        for (const port of node.subworkflow.io.outputs) {
            const outputId = uniqueName(
            slugify((port.name || port.id).replace(/^--/, ''), port.id),
            usedSubOutputs
            );
            outputPortIdToOutputId.set(port.id, outputId);
        }

        stepInfos.set(node.id, {
            nodeId: node.id,
            stepId,
            runPath: subworkflowRunPath,
            inputPortIdToInputId,
            outputPortIdToOutputId,
        });
        }
    }

  // 2. build edge lookup with validation
  const incomingByTargetPort = new Map<string, { sourceNodeId: string; sourcePortId: string }>();

  for (const edge of Object.values(workflow.edges)) {
    if (!edge.sourceHandle || !edge.targetHandle) continue;

    const srcNode = workflow.nodes[edge.source];
    const dstNode = workflow.nodes[edge.target];

    if (!srcNode) {
      diagnostics.push(error(`Edge references missing source node '${edge.source}'.`));
      continue;
    }

    if (!dstNode) {
      diagnostics.push(error(`Edge references missing target node '${edge.target}'.`));
      continue;
    }

    const srcPort = findNodeOutputPort(srcNode, edge.sourceHandle);
    if (!srcPort) {
      diagnostics.push(
        error(`Edge references missing source output port '${edge.sourceHandle}'.`, {
          nodeId: edge.source,
          portId: edge.sourceHandle,
        })
      );
      continue;
    }

    const dstPort = findNodeInputPort(dstNode, edge.targetHandle);
    if (!dstPort) {
      diagnostics.push(
        error(`Edge references missing target input port '${edge.targetHandle}'.`, {
          nodeId: edge.target,
          portId: edge.targetHandle,
        })
      );
      continue;
    }

    incomingByTargetPort.set(`${edge.target}:${edge.targetHandle}`, {
      sourceNodeId: edge.source,
      sourcePortId: edge.sourceHandle,
    });
  }

  // 3. root workflow inputs = top-level input ports without incoming edge
  const workflowInputs: NormalizedWorkflowInput[] = [];
  const workflowInputUsed = new Set<string>();
  const workflowInputMap = new Map<string, string>();

  for (const nodeId of orderedNodeIds) {
    const node = workflow.nodes[nodeId];
    if (!node) continue;
    for (const port of getNodeInputPorts(node)) {
      const key = `${node.id}:${port.id}`;
      if (incomingByTargetPort.has(key)) continue;

      const wfInputId = uniqueName(
        slugify((port.name || port.id).replace(/^--/, ''), port.id),
        workflowInputUsed
      );

      workflowInputMap.set(key, wfInputId);
      workflowInputs.push({
        id: wfInputId,
        type: toCwlPortType(port.dataType),
      });
    }
  }

  // 4. steps
  const steps: NormalizedWorkflowStep[] = [];

  for (const nodeId of orderedNodeIds) {
    const node = workflow.nodes[nodeId];
    if (!node) continue;
    const step = stepInfos.get(node.id);
    if (!step) continue;

    const stepInputs: NormalizedWorkflowStep['in'] = [];

    for (const port of getNodeInputPorts(node)) {
      const stepInputId = step.inputPortIdToInputId.get(port.id);
      if (!stepInputId) continue;

      const incoming = incomingByTargetPort.get(`${node.id}:${port.id}`);
      if (incoming) {
        const srcStep = stepInfos.get(incoming.sourceNodeId);
        const srcOut = srcStep?.outputPortIdToOutputId.get(incoming.sourcePortId);

        if (!srcStep || !srcOut) {
          diagnostics.push(
            error(`Edge into '${node.id}:${port.id}' references unresolved source port.`, {
              nodeId: node.id,
              portId: port.id,
            })
          );
          continue;
        }

        stepInputs.push({
          id: stepInputId,
          source: `${srcStep.stepId}/${srcOut}`,
        });
      } else {
        const wfInputId = workflowInputMap.get(`${node.id}:${port.id}`);
        if (wfInputId) {
          stepInputs.push({
            id: stepInputId,
            source: wfInputId,
          });
        }
      }
    }

    const stepOutputs: string[] = [];
    for (const port of getNodeOutputPorts(node)) {
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

  // 5. root outputs = outputs of leaf nodes
  const outputs: NormalizedWorkflowOutput[] = [];
  const usedWorkflowOutputs = new Set<string>();
  const sourceNodeIds = new Set(Object.values(workflow.edges).map(edge => edge.source));

  for (const nodeId of orderedNodeIds) {
    const node = workflow.nodes[nodeId];
    if (!node) continue;
    if (sourceNodeIds.has(node.id)) continue;

    const step = stepInfos.get(node.id);
    if (!step) continue;

    for (const port of getNodeOutputPorts(node)) {
      const outId = step.outputPortIdToOutputId.get(port.id);
      if (!outId) continue;

      const baseName =
        port.dataType === 'file'
          ? slugify((port.name || 'output').replace(/^--/, ''), 'output')
          : slugify(`${node.name}_${port.name || port.id}`, outId);

      const wfOutId = uniqueName(baseName, usedWorkflowOutputs);

      outputs.push({
        id: wfOutId,
        type: toCwlPortType(port.dataType),
        outputSource: `${step.stepId}/${outId}`,
      });
    }
  }

  const hasSubworkflow = Object.values(workflow.nodes).some(n => n.type === 'subworkflow');

  const workflowDoc: NormalizedWorkflowDoc = {
    kind: 'Workflow',
    label: workflow.name || workflow.id,
    requirements: {
      subworkflowFeature: hasSubworkflow,
    },
    inputs: workflowInputs,
    steps,
    outputs,
  };

  files.unshift({
    path: 'workflow.cwl',
    doc: workflowDoc,
  });

  return {
    workflowDoc,
    files,
    diagnostics,
  };
}