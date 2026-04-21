/**
 * @file TaskParameterSection.tsx
 * @brief Section for managing task parameters.
 * @author Silvia Šlachtovská
 *
 * Allows the user to:
 * - inspect existing parameters,
 * - create new parameters of different kinds,
 * - edit parameter metadata,
 * - remove parameters,
 * - define whether parameters are exposed as workflow inputs or outputs.
 */

import styles from '../../RightPanel.module.css';
import type {
  Workflow,
  WorkflowNode,
  ParamKind,
  TaskParam,
} from '../../../../../../domain/workflow/model/model';
import type { Action } from '../../../../../../domain/workflow/model/actions';
import { XMarkIcon, CheckIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  SectionTitle,
  LabeledInput,
  BoolSelect,
  AddParamButton,
  RoleCheckboxes,
} from '../../formFields';
import {
  uid,
  getParamRole,
  getParamDisplayValue,
} from '../../rightPanelUtils';

type TaskNodeOnly = Extract<WorkflowNode, { type: 'task' }>;

export function TaskParametersSection({
  node,
  activeWorkflow,
  dispatch,
  draftParam,
  setDraftParam,
  editingParamId,
  setEditingParamId,
}: {
  node: TaskNodeOnly;
  activeWorkflow: Workflow;
  dispatch: React.Dispatch<Action>;
  draftParam: TaskParam | null;
  setDraftParam: React.Dispatch<React.SetStateAction<TaskParam | null>>;
  editingParamId: string | null;
  setEditingParamId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  function createDraft(kind: ParamKind, indexHint: number): TaskParam {
    return {
      id: uid('param'),
      kind,
      name: `parameter_${indexHint}`,
      flag: kind === 'bool' ? '--flag' : '--param',
      value: kind === 'bool' ? 'true' : '',
      options: kind === 'choice' ? ['a', 'b'] : undefined,
      required: false,
      description: '',
    };
  }

  function openNewRegular(kind: ParamKind) {
    setEditingParamId(null);
    setDraftParam({
      ...createDraft(kind, node.task.params.length + 1),
      exposeAsInput: false,
      exposeAsOutput: false,
    });
  }

  function openEdit(p: TaskParam) {
    setEditingParamId(p.id);
    setDraftParam({ ...p, options: p.options ? [...p.options] : undefined });
  }

  function cancelDraft() {
    setDraftParam(null);
    setEditingParamId(null);
  }

  function saveDraft() {
    if (!draftParam) return;

    if (editingParamId === null) {
      dispatch({ type: 'task/paramAdd', nodeId: node.id, param: draftParam });
    } else {
      dispatch({
        type: 'task/paramUpdate',
        nodeId: node.id,
        paramId: editingParamId,
        patch: {
          name: draftParam.name,
          flag: draftParam.flag,
          value: draftParam.value,
          options: draftParam.options,
          required: draftParam.required,
          description: draftParam.description,
          exposeAsInput: draftParam.exposeAsInput,
          exposeAsOutput: draftParam.exposeAsOutput,
        },
      });
    }

    cancelDraft();
  }

  const allParams = node.task.params;

  return (
    <section className={styles.section}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <SectionTitle>Parameters</SectionTitle>
        </div>

        {allParams.length > 0 && (
          <div className={styles.paramList}>
            {allParams.map((p) => {
              const role = getParamRole(p);
              const displayValue = getParamDisplayValue(node.id, p, activeWorkflow);

              return (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.paramChip} ${styles['paramChip_' + role]}`}
                  onClick={() => openEdit(p)}
                  title="Click to edit"
                >
                  <span className={styles.paramChipName}>{p.name}</span>
                  <span className={styles.paramChipType}> ({p.kind})</span>
                  <span className={styles.paramChipSep}>:</span>
                  <span className={styles.paramChipValue}>{displayValue}</span>
                </button>
              );
            })}
          </div>
        )}

        {draftParam && (
          <div className={styles.paramEditorCard}>
            <div className={styles.paramEditorHeader}>
              <div className={styles.paramEditorTitle}>{draftParam.kind}</div>

              <div className={styles.paramEditorActions}>
                <button
                  type="button"
                  className={styles.iconBtnDelete}
                  onClick={() => {
                    if (editingParamId) {
                      dispatch({
                        type: 'task/paramRemove',
                        nodeId: node.id,
                        paramId: editingParamId,
                      });
                    }
                    cancelDraft();
                  }}
                  title="Delete parameter"
                >
                  <TrashIcon className="icon_trash" />
                </button>

                <button
                  type="button"
                  className={styles.iconBtnOk}
                  onClick={saveDraft}
                  title="Save"
                >
                  <CheckIcon className="icon_check" />
                </button>

                <button
                  type="button"
                  className={styles.iconBtnCancel}
                  onClick={cancelDraft}
                  title="Cancel"
                >
                  <XMarkIcon className="icon_x" />
                </button>
              </div>
            </div>

            <div className={styles.paramEditorBody}>
              <LabeledInput
                label="parameter name"
                value={draftParam.name}
                onChange={(v) => setDraftParam({ ...draftParam, name: v })}
              />

              <LabeledInput
                label="flag"
                value={draftParam.flag ?? ''}
                onChange={(v) => setDraftParam({ ...draftParam, flag: v })}
              />

              {draftParam.kind === 'bool' ? (
                <BoolSelect
                  label="value"
                  value={draftParam.value}
                  onChange={(v) => setDraftParam({ ...draftParam, value: v })}
                />
              ) : (
                <LabeledInput
                  label="value"
                  value={draftParam.value}
                  onChange={(v) => setDraftParam({ ...draftParam, value: v })}
                />
              )}

              {draftParam.kind === 'choice' && (
                <LabeledInput
                  label="options (comma separated)"
                  value={(draftParam.options ?? []).join(',')}
                  onChange={(v) =>
                    setDraftParam({
                      ...draftParam,
                      options: v.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              )}

              <RoleCheckboxes

                value={getParamRole(draftParam)}
                onChange={(role) =>
                  setDraftParam({
                    ...draftParam,
                    exposeAsInput: role === 'input',
                    exposeAsOutput: role === 'output',
                  })
                }
              />
            </div>
          </div>
        )}

        <div className={styles.addParamRow}>
          <AddParamButton onClick={() => openNewRegular('string')}>
            <PlusIcon className={styles.iconPlus} /> string
          </AddParamButton>
          <AddParamButton onClick={() => openNewRegular('number')}>
            <PlusIcon className={styles.iconPlus} /> number
          </AddParamButton>
          <AddParamButton onClick={() => openNewRegular('bool')}>
            <PlusIcon className={styles.iconPlus} /> bool
          </AddParamButton>
          <AddParamButton onClick={() => openNewRegular('choice')}>
            <PlusIcon className={styles.iconPlus} /> choice
          </AddParamButton>
          <AddParamButton onClick={() => openNewRegular('file')}>
            <PlusIcon className={styles.iconPlus} /> file
          </AddParamButton>
          <AddParamButton onClick={() => openNewRegular('directory')}>
            <PlusIcon className={styles.iconPlus} /> directory
          </AddParamButton>
        </div>
      </div>
    </section>
  );
}