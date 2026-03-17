/**
 * @file TaskBatchSection.tsx
 * @brief Section in the right panel showing batch execution settings for a task node.
 * @author Silvia Šlachtovská
 * 
 */

import styles from '../../RightPanel.module.css';
import type { WorkflowNode } from '../../../state/model';
import type { Action } from '../../../state/workflowReducer';
import {
  SectionTitle,
  NumberInput,
  LabeledInput,
  TextAreaInput,
} from '../rightPanelFormParts';

type TaskNodeOnly = Extract<WorkflowNode, { type: 'task' }>;

export function TaskBatchSection({
  node,
  workflowBackend,
  dispatch,
}: {
  node: TaskNodeOnly;
  workflowBackend: 'local' | 'slurm' | 'pbs';
  dispatch: React.Dispatch<Action>;
}) {
  if (workflowBackend === 'local') {
    return <section className={styles.section} />;
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <SectionTitle>{workflowBackend}</SectionTitle>
      </div>

      <div className={styles.grid2}>
        <NumberInput
          label="cpus"
          value={node.task.batch.cpus ?? ''}
          onChange={(n) => {
            const patch = {
              task: { ...node.task, batch: { ...node.task.batch, cpus: n } },
            } as Partial<WorkflowNode>;
            dispatch({ type: 'node/update', nodeId: node.id, patch });
          }}
        />

        <NumberInput
          label="mem (MB)"
          value={node.task.batch.memMB ?? ''}
          onChange={(n) => {
            const patch = {
              task: { ...node.task, batch: { ...node.task.batch, memMB: n } },
            } as Partial<WorkflowNode>;
            dispatch({ type: 'node/update', nodeId: node.id, patch });
          }}
        />

        <NumberInput
          label="time (min)"
          value={node.task.batch.timeMin ?? ''}
          onChange={(n) => {
            const patch = {
              task: { ...node.task, batch: { ...node.task.batch, timeMin: n } },
            } as Partial<WorkflowNode>;
            dispatch({ type: 'node/update', nodeId: node.id, patch });
          }}
        />

        <LabeledInput
          label={workflowBackend === 'slurm' ? 'partition' : 'queue'}
          value={node.task.batch.partitionOrQueue ?? ''}
          onChange={(v) => {
            const patch = {
              task: {
                ...node.task,
                batch: { ...node.task.batch, partitionOrQueue: v },
              },
            } as Partial<WorkflowNode>;
            dispatch({ type: 'node/update', nodeId: node.id, patch });
          }}
        />

        <LabeledInput
          label="account"
          value={node.task.batch.account ?? ''}
          onChange={(v) => {
            const patch = {
              task: {
                ...node.task,
                batch: { ...node.task.batch, account: v },
              },
            } as Partial<WorkflowNode>;
            dispatch({ type: 'node/update', nodeId: node.id, patch });
          }}
        />

        <LabeledInput
          label="qos"
          value={node.task.batch.qos ?? ''}
          onChange={(v) => {
            const patch = {
              task: {
                ...node.task,
                batch: { ...node.task.batch, qos: v },
              },
            } as Partial<WorkflowNode>;
            dispatch({ type: 'node/update', nodeId: node.id, patch });
          }}
        />
      </div>

      <TextAreaInput
        label={`custom ${workflowBackend} directives`}
        value={node.task.batch.customDirectives ?? node.task.batch.custom ?? ''}
        onChange={(v) => {
          const patch = {
            task: {
              ...node.task,
              batch: {
                ...node.task.batch,
                customDirectives: v,
              },
            },
          } as Partial<WorkflowNode>;
          dispatch({ type: 'node/update', nodeId: node.id, patch });
        }}
        placeholder={
          workflowBackend === 'slurm'
            ? '-G 1\n--constraint=zen3'
            : '-l place=free'
        }
      />

      <TextAreaInput
        label="prologue script"
        value={node.task.batch.prologue ?? ''}
        onChange={(v) => {
          const patch = {
            task: {
              ...node.task,
              batch: {
                ...node.task.batch,
                prologue: v,
              },
            },
          } as Partial<WorkflowNode>;
          dispatch({ type: 'node/update', nodeId: node.id, patch });
        }}
        placeholder={`# commands before main task\nml purge\nml GCC/9.3.0`}
      />

      <TextAreaInput
        label="epilogue script"
        value={node.task.batch.epilogue ?? ''}
        onChange={(v) => {
          const patch = {
            task: {
              ...node.task,
              batch: {
                ...node.task.batch,
                epilogue: v,
              },
            },
          } as Partial<WorkflowNode>;
          dispatch({ type: 'node/update', nodeId: node.id, patch });
        }}
        placeholder="# commands after main task"
      />

      <div className={styles.arrayBox}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={node.task.batch.array?.enabled ?? false}
            onChange={(e) => {
              const enabled = e.target.checked;
              const current = node.task.batch.array ?? { enabled: false };
              const patch = {
                task: {
                  ...node.task,
                  batch: {
                    ...node.task.batch,
                    array: { ...current, enabled },
                  },
                },
              } as Partial<WorkflowNode>;
              dispatch({ type: 'node/update', nodeId: node.id, patch });
            }}
          />
          <span>array job</span>
        </label>

        {node.task.batch.array?.enabled && (
          <div className={styles.grid2}>
            <NumberInput
              label="start"
              value={node.task.batch.array.start ?? ''}
              onChange={(n) => {
                const a = node.task.batch.array ?? { enabled: true };
                const patch = {
                  task: {
                    ...node.task,
                    batch: { ...node.task.batch, array: { ...a, start: n } },
                  },
                } as Partial<WorkflowNode>;
                dispatch({ type: 'node/update', nodeId: node.id, patch });
              }}
            />
            <NumberInput
              label="end"
              value={node.task.batch.array.end ?? ''}
              onChange={(n) => {
                const a = node.task.batch.array ?? { enabled: true };
                const patch = {
                  task: {
                    ...node.task,
                    batch: { ...node.task.batch, array: { ...a, end: n } },
                  },
                } as Partial<WorkflowNode>;
                dispatch({ type: 'node/update', nodeId: node.id, patch });
              }}
            />
            <NumberInput
              label="step"
              value={node.task.batch.array.step ?? ''}
              onChange={(n) => {
                const a = node.task.batch.array ?? { enabled: true };
                const patch = {
                  task: {
                    ...node.task,
                    batch: { ...node.task.batch, array: { ...a, step: n } },
                  },
                } as Partial<WorkflowNode>;
                dispatch({ type: 'node/update', nodeId: node.id, patch });
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}