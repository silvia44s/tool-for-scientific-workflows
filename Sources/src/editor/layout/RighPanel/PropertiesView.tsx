/**
 * @file PropertiesView.tsx
 * @brief Component for displaying and editing properties of the selected node or workflow.
 * @author Silvia Šlachtovská
 * 
 */

import { useState } from 'react';
import styles from '../RightPanel.module.css';
import { useWorkflowState } from '../../state/workflowState';
import { getActiveWorkflow } from '../../state/workflowUtils';
import type { WorkflowNode, TaskParam, EnvVar } from '../../state/model';
import { buildTaskPreset } from '../../state/nodePresets';
import {
  SectionTitle,
  LabeledInput,
} from './rightPanelFormParts';
import { downloadJson } from './rightPanelUtils';
import { WorkflowPropertiesSection } from './sections/WorkflowPropertiesSection';
import { TaskProgramSection } from './sections/TaskProgramSection';
import { TaskParametersSection } from './sections/TaskParameterSection';
import { TaskEnvironmentSection } from './sections/TaskEnvironmentSection';
import { TaskBatchSection } from './sections/TaskBatchSection';
import { SubworkflowPropertiesSection } from './sections/SubworkflowPropertiesSection';

export function PropertiesView() {
  const { state, dispatch } = useWorkflowState();

  const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
  const workflowBackend = activeWorkflow.run?.backend ?? state.workflow.run?.backend ?? 'local';

  const selectedNodes = state.selectedNodeIds
    .map((id) => activeWorkflow.nodes[id])
    .filter(Boolean);

  const selected = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const multiSelected = selectedNodes.length >= 2;

  const [draftParam, setDraftParam] = useState<TaskParam | null>(null);
  const [editingParamId, setEditingParamId] = useState<string | null>(null);

  const [draftVar, setDraftVar] = useState<EnvVar | null>(null);
  const [editingVarId, setEditingVarId] = useState<string | null>(null);

  if (multiSelected) {
    const taskOnly = selectedNodes.every((n) => n.type === 'task');

    return (
      <div className={styles.properties}>
        <section className={styles.section}>
          <SectionTitle>Selection</SectionTitle>

          <div className={styles.hintText}>
            {selectedNodes.length} nodes selected.
          </div>

          {!taskOnly && (
            <div className={styles.hintText}>
              Only task nodes can be grouped into a subworkflow.
            </div>
          )}

          {taskOnly && (
            <div className={styles.hintText}>
              You can create a subworkflow from this selection.
            </div>
          )}
        </section>
      </div>
    );
  }

  if (!selected) {
    return <WorkflowPropertiesSection state={state} dispatch={dispatch} />;
  }

  return (
    <div className={styles.properties}>
      <section className={styles.section}>
        <LabeledInput
          label="node name"
          value={selected.name}
          onChange={(v) =>
            dispatch({
              type: 'node/update',
              nodeId: selected.id,
              patch: { name: v } as Partial<WorkflowNode>,
            })
          }
        />
      </section>

      {selected.type === 'subworkflow' && (
        <>
          <section className={styles.section}>
            <LabeledInput
              label="description"
              value={selected.description ?? ''}
              onChange={(v) =>
                dispatch({
                  type: 'node/update',
                  nodeId: selected.id,
                  patch: { description: v } as Partial<WorkflowNode>,
                })
              }
            />
          </section>

          <SubworkflowPropertiesSection node={selected} />
        </>
      )}

      {selected.type === 'task' && (
        <div className={styles.taskNode}>
          <TaskProgramSection node={selected} dispatch={dispatch} />

          <TaskParametersSection
            node={selected}
            activeWorkflow={activeWorkflow}
            dispatch={dispatch}
            draftParam={draftParam}
            setDraftParam={setDraftParam}
            editingParamId={editingParamId}
            setEditingParamId={setEditingParamId}
          />

          <TaskEnvironmentSection
            node={selected}
            dispatch={dispatch}
            draftVar={draftVar}
            setDraftVar={setDraftVar}
            editingVarId={editingVarId}
            setEditingVarId={setEditingVarId}
          />

          <TaskBatchSection
            node={selected}
            workflowBackend={workflowBackend}
            dispatch={dispatch}
          />

          <section className={styles.section}>
            <button
              type="button"
              className={styles.exportPreset}
              onClick={() => {
                const preset = buildTaskPreset(selected);
                downloadJson(`${selected.name || 'task'}.preset.json`, preset);
              }}
            >
              Save node preset
            </button>
          </section>
        </div>
      )}
    </div>
  );
}