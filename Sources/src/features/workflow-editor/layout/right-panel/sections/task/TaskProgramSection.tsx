/**
 * @file TaskProgramSection.tsx
 * @brief Section for editing the executable program of a task node.
 * @author Silvia Šlachtovská
 *
 * Contains inputs for configuring the command, script, or program
 * that defines the task execution.
 */

import styles from '../../RightPanel.module.css';
import type { WorkflowNode } from '../../../../../../domain/workflow/model/model';
import type { Action } from '../../../../../../domain/workflow/model/actions';
import { SectionTitle, LabeledInput } from '../../formFields';

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