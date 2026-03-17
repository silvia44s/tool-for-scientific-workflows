/**
 * @file TaskParameterSection.tsx
 * @brief Section in the right panel showing parameters of a task node, allowing to add/edit/remove them.
 * @author Silvia Šlachtovská
 *
 */

import styles from '../../RightPanel.module.css';
import type { WorkflowNode } from '../../../state/model';
import type { Action } from '../../../state/workflowReducer';
import { SectionTitle, LabeledInput } from '../rightPanelFormParts';

type TaskNodeOnly = Extract<WorkflowNode, { type: 'task' }>;

export function TaskProgramSection({
  node,
  dispatch,
}: {
  node: TaskNodeOnly;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <section className={styles.section}>
      <SectionTitle>Program</SectionTitle>

      <LabeledInput
        label="binary path"
        value={node.task.config.binaryPath}
        onChange={(v) => {
          const patch = {
            task: {
              ...node.task,
              config: { ...node.task.config, binaryPath: v },
            },
          } as Partial<WorkflowNode>;

          dispatch({ type: 'node/update', nodeId: node.id, patch });
        }}
      />

      <LabeledInput
        label="workdir"
        value={node.task.config.workdir ?? ''}
        onChange={(v) => {
          const patch = {
            task: {
              ...node.task,
              config: { ...node.task.config, workdir: v },
            },
          } as Partial<WorkflowNode>;

          dispatch({ type: 'node/update', nodeId: node.id, patch });
        }}
      />
    </section>
  );
}