/**
 * @file TaskPropertiesView.tsx
 * @brief Properties editor for a selected task node.
 * @author Silvia Šlachtovská
 *
 * Provides a structured UI for editing all aspects of a task node,
 * including program definition, parameters, environment variables,
 * batch settings, and preset export.
 */

import { useState } from 'react';
import styles from '../RightPanel.module.css';
import type {
  EnvVar,
  TaskNode,
  TaskParam,
  Workflow,
  WorkflowNode,
} from '../../../../../domain/workflow/model/model';
import type { Action } from '../../../../../domain/workflow/model/actions';
import { buildTaskPreset } from '../../../../../domain/workflow/operations/taskPresets';
import { LabeledInput } from '../formFields';
import { downloadJson } from '../rightPanelUtils';
import { TaskProgramSection } from '../sections/task/TaskProgramSection';
import { TaskParametersSection } from '../sections/task/TaskParameterSection';
import { TaskEnvironmentSection } from '../sections/task/TaskEnvironmentSection';
import { TaskBatchSection } from '../sections/task/TaskBatchSection';
import toast from 'react-hot-toast';

type TaskPropertiesViewProps = {
  node: TaskNode;
  activeWorkflow: Workflow;
  workflowBackend: 'local' | 'slurm' | 'pbs';
  dispatch: React.Dispatch<Action>;
};

export function TaskPropertiesView({
  node,
  activeWorkflow,
  workflowBackend,
  dispatch,
}: TaskPropertiesViewProps) {
  const [draftParam, setDraftParam] = useState<TaskParam | null>(null);
  const [editingParamId, setEditingParamId] = useState<string | null>(null);

  const [draftVar, setDraftVar] = useState<EnvVar | null>(null);
  const [editingVarId, setEditingVarId] = useState<string | null>(null);

  return (
    <div className={styles.properties}>
      <section className={styles.section}>
        <LabeledInput
          label="node name"
          value={node.name}
          onChange={(value) =>
            dispatch({
              type: 'node/update',
              nodeId: node.id,
              patch: { name: value } as Partial<WorkflowNode>,
            })
          }
        />
      </section>

      <div className={styles.taskNode}>
        <TaskProgramSection node={node} dispatch={dispatch} />

        <TaskParametersSection
          node={node}
          activeWorkflow={activeWorkflow}
          dispatch={dispatch}
          draftParam={draftParam}
          setDraftParam={setDraftParam}
          editingParamId={editingParamId}
          setEditingParamId={setEditingParamId}
        />

        <TaskEnvironmentSection
          node={node}
          dispatch={dispatch}
          draftVar={draftVar}
          setDraftVar={setDraftVar}
          editingVarId={editingVarId}
          setEditingVarId={setEditingVarId}
        />

        <TaskBatchSection
          node={node}
          workflowBackend={workflowBackend}
          dispatch={dispatch}
        />

        <section className={styles.section}>
          <button
            type="button"
            className={styles.exportPreset}
            onClick={() => {
              const preset = buildTaskPreset(node);
              downloadJson(`${node.name || 'task'}.preset.json`, preset);
              toast.success('Node preset downloaded to files');
            }}
          >
            Save node preset
          </button>
        </section>
      </div>
    </div>
  );
}