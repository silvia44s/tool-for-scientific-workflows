/**
 * @file TaskEnvironmentSection.tsx
 * @brief Section in the right panel showing environment settings for a task node.
 * @author Silvia Šlachtovská
 *
 */

import styles from '../../RightPanel.module.css';
import type { EnvVar, WorkflowNode } from '../../../state/model';
import type { Action } from '../../../state/workflowReducer';
import { XMarkIcon, CheckIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  SectionTitle,
  LabeledInput,
  SimpleStringList,
} from '../rightPanelFormParts';
import { uid } from '../rightPanelUtils';

type TaskNodeOnly = Extract<WorkflowNode, { type: 'task' }>;

export function TaskEnvironmentSection({
  node,
  dispatch,
  draftVar,
  setDraftVar,
  editingVarId,
  setEditingVarId,
}: {
  node: TaskNodeOnly;
  dispatch: React.Dispatch<Action>;
  draftVar: EnvVar | null;
  setDraftVar: React.Dispatch<React.SetStateAction<EnvVar | null>>;
  editingVarId: string | null;
  setEditingVarId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  function createVarDraft(indexHint: number): EnvVar {
    return { id: uid('env'), key: `VAR_${indexHint}`, value: '' };
  }

  function openNewVar() {
    setEditingVarId(null);
    setDraftVar(createVarDraft(node.task.environment.variables.length + 1));
  }

  function openEditVar(v: EnvVar) {
    setEditingVarId(v.id);
    setDraftVar({ ...v });
  }

  function cancelVarDraft() {
    setDraftVar(null);
    setEditingVarId(null);
  }

  function saveVarDraft() {
    if (!draftVar) return;

    if (editingVarId === null) {
      dispatch({ type: 'task/envVarAdd', nodeId: node.id, variable: draftVar });
    } else {
      dispatch({
        type: 'task/envVarUpdate',
        nodeId: node.id,
        varId: editingVarId,
        patch: { key: draftVar.key, value: draftVar.value },
      });
    }

    cancelVarDraft();
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <SectionTitle>Environment</SectionTitle>
      </div>

      <div className={styles.subTitle}>variables</div>

      {node.task.environment.variables.length > 0 && (
        <div className={styles.paramList}>
          {node.task.environment.variables.map((v) => (
            <button
              key={v.id}
              type="button"
              className={styles.paramChip}
              onClick={() => openEditVar(v)}
              title="Click to edit"
            >
              <span className={styles.paramChipName}>{v.key}</span>
              <span className={styles.paramChipSep}>=</span>
              <span className={styles.paramChipValue}>{v.value || '(empty)'}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.addParamRow}>
        <button type="button" className={styles.addParamBtn} onClick={openNewVar}>
          <PlusIcon className={styles.iconPlus} /> variable
        </button>
      </div>

      {draftVar && (
        <div className={styles.paramEditorCard}>
          <div className={styles.paramEditorHeader}>
            <div className={styles.paramEditorTitle}>env var</div>

            <div className={styles.paramEditorActions}>
              <button
                type="button"
                className={styles.iconBtnDelete}
                onClick={() => {
                  if (editingVarId) {
                    dispatch({
                      type: 'task/envVarRemove',
                      nodeId: node.id,
                      varId: editingVarId,
                    });
                  }
                  cancelVarDraft();
                }}
                title="Delete"
              >
                <TrashIcon className={styles.iconAction} />
              </button>

              <button
                type="button"
                className={styles.iconBtnOk}
                onClick={saveVarDraft}
                title="Save"
              >
                <CheckIcon className={styles.iconAction} />
              </button>

              <button
                type="button"
                className={styles.iconBtnCancel}
                onClick={cancelVarDraft}
                title="Cancel"
              >
                <XMarkIcon className={styles.iconAction} />
              </button>
            </div>
          </div>

          <div className={styles.paramEditorBody}>
            <LabeledInput
              label="key"
              value={draftVar.key}
              onChange={(v) => setDraftVar({ ...draftVar, key: v })}
            />
            <LabeledInput
              label="value"
              value={draftVar.value}
              onChange={(v) => setDraftVar({ ...draftVar, value: v })}
            />
          </div>
        </div>
      )}

      <div className={styles.subTitle} style={{ marginTop: 12 }}>modules</div>

      <SimpleStringList
        items={node.task.environment.modules}
        placeholder="e.g. gcc/12.2.0"
        onAdd={(txt) =>
          dispatch({ type: 'task/moduleAdd', nodeId: node.id, moduleName: txt })
        }
        onUpdate={(i, txt) =>
          dispatch({ type: 'task/moduleUpdate', nodeId: node.id, index: i, moduleName: txt })
        }
        onRemove={(i) =>
          dispatch({ type: 'task/moduleRemove', nodeId: node.id, index: i })
        }
      />

      <div className={styles.subTitle} style={{ marginTop: 12 }}>library paths</div>

      <SimpleStringList
        items={node.task.environment.libraries}
        placeholder="e.g. /opt/lib"
        onAdd={(txt) =>
          dispatch({ type: 'task/libraryAdd', nodeId: node.id, library: txt })
        }
        onUpdate={(i, txt) =>
          dispatch({ type: 'task/libraryUpdate', nodeId: node.id, index: i, library: txt })
        }
        onRemove={(i) =>
          dispatch({ type: 'task/libraryRemove', nodeId: node.id, index: i })
        }
      />
    </section>
  );
}