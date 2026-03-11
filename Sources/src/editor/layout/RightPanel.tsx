/**
 * @file RightPanel.tsx
 * @brief Right sidebar for workflow and node editing.
 * @author Silvia Šlachtovská
 *
 * This panel has two main views:
 * - JSON view showing the whole workflow document
 * - Properties view used to edit workflow settings or the selected node
 *
 * When no node is selected, the panel shows workflow-level settings.
 * When a task node is selected, the panel shows forms for editing:
 * - basic task config
 * - parameters / inputs / outputs
 * - environment variables
 * - modules and library paths
 * - batch execution options
 */

import { useState } from 'react';
import styles from './RightPanel.module.css';
import { useWorkflowState } from '../state/workflowState';
import type { WorkflowNode, ParamKind, TaskParam } from '../state/model';
import type { EnvVar } from '../state/model';
import { buildTaskPreset } from '../state/nodePresets';

import { XMarkIcon, CheckIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/outline";

/**
 * Available tabs in the right panel.
 */
type TabKey = 'json' | 'properties';


/**
 * Main right sidebar component.
 *
 * Handles tab switching between the JSON preview
 * and the editable properties form.
 */
export function RightPanel() {
  const [tab, setTab] = useState<TabKey>('properties');

  return (
    <div className={styles.root}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'json' ? styles.active : ''}`}
          onClick={() => setTab('json')}
          type="button"
        >
          JSON
        </button>
        <button
          className={`${styles.tab} ${tab === 'properties' ? styles.active : ''}`}
          onClick={() => setTab('properties')}
          type="button"
        >
          Properties
        </button>
      </div>

      <div className={styles.content}>
        {tab === 'properties' ? <PropertiesView /> : <JsonView />}
      </div>
    </div>
  );
}


/**
 * Property editor view shown in the right panel.
 *
 * This component edits either:
 * - workflow-level properties, when no node is selected
 * - selected task node properties, when a node is selected
 *
 * It also manages local draft state for parameter and environment editors,
 * so changes can be confirmed or cancelled before dispatching to global state.
 */
function PropertiesView() {
  const { state, dispatch } = useWorkflowState();

  const selected = state.selectedNodeId
    ? state.workflow.nodes[state.selectedNodeId]
    : null;

  /**
   * Temporary local state for parameter editing.
   * This is not committed into the global workflow state until saved.
   */
  const [draftParam, setDraftParam] = useState<TaskParam | null>(null);
  const [editingParamId, setEditingParamId] = useState<string | null>(null);

  /**
   * Temporary local state for environment variable editing.
   */
  const [draftVar, setDraftVar] = useState<EnvVar | null>(null);
  const [editingVarId, setEditingVarId] = useState<string | null>(null);


  /**
   * Small helper for generating temporary unique IDs.
   */
  function uid(prefix: string) {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }


  /**
   * Create a new draft parameter with sensible default values.
   */
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


  /*
  function openNew(kind: ParamKind, nodeId: string) {
    const node = state.workflow.nodes[nodeId];
    if (!node || node.type !== 'task') return;

    setEditingParamId(null);
    setDraftParam(createDraft(kind, node.task.params.length + 1));
  }*/


  /**
   * Parameters are split into three groups for easier editing in UI:
   * - regular params
   * - input params (exposed as input ports)
   * - output params (exposed as output ports)
   */
  const regularParams =
    selected && selected.type === 'task'
      ? selected.task.params.filter((p) => !p.exposeAsInput && !p.exposeAsOutput)
      : [];

  const inputParams =
    selected && selected.type === 'task'
      ? selected.task.params.filter((p) => p.exposeAsInput)
      : [];

  const outputParams =
    selected && selected.type === 'task'
      ? selected.task.params.filter((p) => p.exposeAsOutput)
      : [];


  /**
   * Open draft editor for a new regular parameter.
   */
  function openNewRegular(kind: ParamKind, nodeId: string) {
    const node = state.workflow.nodes[nodeId];
    if (!node || node.type !== 'task') return;

    setEditingParamId(null);
    setDraftParam({
      ...createDraft(kind, node.task.params.length + 1),
      exposeAsInput: false,
      exposeAsOutput: false,
    });
  }


  /**
   * Open draft editor for a new input parameter.
   */
  function openNewInput(kind: ParamKind, nodeId: string) {
    const node = state.workflow.nodes[nodeId];
    if (!node || node.type !== 'task') return;

    setEditingParamId(null);
    setDraftParam({
      ...createDraft(kind, node.task.params.length + 1),
      exposeAsInput: true,
      exposeAsOutput: false,
    });
  }


  /**
   * Open draft editor for a new output parameter.
   */
  function openNewOutput(kind: ParamKind, nodeId: string) {
    const node = state.workflow.nodes[nodeId];
    if (!node || node.type !== 'task') return;

    setEditingParamId(null);
    setDraftParam({
      ...createDraft(kind, node.task.params.length + 1),
      exposeAsInput: false,
      exposeAsOutput: true,
    });
  }


  /**
   * Open editor for an existing parameter.
   */
  function openEdit(p: TaskParam) {
    setEditingParamId(p.id);
    setDraftParam({ ...p, options: p.options ? [...p.options] : undefined });
  }


  /**
   * Cancel current parameter edit session.
   */
  function cancelDraft() {
    setDraftParam(null);
    setEditingParamId(null);
  }


  /**
   * Save current parameter draft into global workflow state.
   * If editingParamId is null, a new parameter is created.
   * Otherwise the existing parameter is updated.
   */
  function saveDraft(nodeId: string) {
    if (!draftParam) return;

    if (editingParamId === null) {
      dispatch({ type: 'task/paramAdd', nodeId, param: draftParam });
    } else {
      dispatch({
        type: 'task/paramUpdate',
        nodeId,
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


  /**
   * Create a new environment variable draft.
   */
  function createVarDraft(indexHint: number): EnvVar {
    return { id: uid('env'), key: `VAR_${indexHint}`, value: '' };
  }


  /**
   * Open editor for a new environment variable.
   */
  function openNewVar(nodeId: string) {
    const node = state.workflow.nodes[nodeId];
    if (!node || node.type !== 'task') return;

    setEditingVarId(null);
    setDraftVar(createVarDraft(node.task.environment.variables.length + 1));
  }


  /**
   * Open editor for an existing environment variable.
   */
  function openEditVar(v: EnvVar) {
    setEditingVarId(v.id);
    setDraftVar({ ...v });
  }


  /**
   * Cancel env var editing.
   */
  function cancelVarDraft() {
    setDraftVar(null);
    setEditingVarId(null);
  }


  /**
   * Save current env var draft into global state.
   */
  function saveVarDraft(nodeId: string) {
    if (!draftVar) return;

    if (editingVarId === null) {
      dispatch({ type: 'task/envVarAdd', nodeId, variable: draftVar });
    } else {
      dispatch({
        type: 'task/envVarUpdate',
        nodeId,
        varId: editingVarId,
        patch: { key: draftVar.key, value: draftVar.value }
      });
    }

    cancelVarDraft();
  }


  /**
   * If no node is selected, show workflow-level settings only.
   */
  if (!selected) {
    return (
      <div className={styles.properties}>
        <section className={styles.section}>
          <SectionTitle>Workflow</SectionTitle>

          <LabeledInput
            label="workflow name"
            value={state.workflow.name}
            onChange={(v) => dispatch({ type: 'workflow/setName', name: v })}
          />

          <LabeledInput
            label="results root"
            value={state.workflow.run?.resultsRoot ?? ''}
            onChange={(v) =>
              dispatch({ type: 'workflow/setResultsRoot', resultsRoot: v })
            }
          />

          <div className={styles.hintText}>
            Default folder where outputs will be generated/saved during RUN
          </div>
        </section>

        <div className={styles.placeholder}>
          No node selected. Click a node to edit it.
        </div>
      </div>
    );
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

      {selected.type === 'task' && (
        <div className={styles.taskNode}>
          {/* ---------------- PROGRAM ---------------- */}
          <section className={styles.section}>
            <SectionTitle>Program</SectionTitle>

            <LabeledInput
              label="binary path"
              value={selected.task.config.binaryPath}
              onChange={(v) => {
                const patch = {
                  task: {
                    ...selected.task,
                    config: { ...selected.task.config, binaryPath: v },
                  },
                } as Partial<WorkflowNode>;
                dispatch({ type: 'node/update', nodeId: selected.id, patch });
              }}
            />

            <LabeledInput
              label="workdir"
              value={selected.task.config.workdir ?? ''}
              onChange={(v) => {
                const patch = {
                  task: {
                    ...selected.task,
                    config: { ...selected.task.config, workdir: v },
                  },
                } as Partial<WorkflowNode>;
                dispatch({ type: 'node/update', nodeId: selected.id, patch });
              }}
            />
          </section>

          {/* ---------------- PARAMETERS / IO ---------------- */}
          <section className={styles.section}>

            {/* Regular task parameters not exposed as ports */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <SectionTitle>Parameters</SectionTitle>
              </div>

              {regularParams.length > 0 && (
                <div className={styles.paramList}>
                  {regularParams.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={styles.paramChip}
                      onClick={() => openEdit(p)}
                      title="Click to edit"
                    >
                      <span className={styles.paramChipName}>{p.name}</span>
                      <span className={styles.paramChipSep}>:</span>
                      <span className={styles.paramChipValue}>
                        {p.kind === 'bool'
                          ? p.value === 'false'
                            ? 'false'
                            : 'true'
                          : p.value || '(empty)'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.addParamRow}>
                <AddParamButton onClick={() => openNewRegular('string', selected.id)}>
                  <PlusIcon className={styles.iconPlus} /> string
                </AddParamButton>
                <AddParamButton onClick={() => openNewRegular('number', selected.id)}>
                  <PlusIcon className={styles.iconPlus} /> number
                </AddParamButton>
                <AddParamButton onClick={() => openNewRegular('bool', selected.id)}>
                  <PlusIcon className={styles.iconPlus} /> bool
                </AddParamButton>
                <AddParamButton onClick={() => openNewRegular('choice', selected.id)}>
                  <PlusIcon className={styles.iconPlus} /> choice
                </AddParamButton>
              </div>

              {regularParams.length === 0 && !draftParam && (
                <div className={styles.hintText}>No parameters yet.</div>
              )}
            </div>

            {/* Input parameters exposed as input ports */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <SectionTitle>Inputs</SectionTitle>
              </div>

              {inputParams.length > 0 && (
                <div className={styles.paramList}>
                  {inputParams.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={styles.paramChip}
                      onClick={() => openEdit(p)}
                      title="Click to edit"
                    >
                      <span className={styles.paramChipName}>{p.name}</span>
                      <span className={styles.paramChipSep}>:</span>
                      <span className={styles.paramChipValue}>
                        {p.value || '(connected / empty)'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.addParamRow}>
                <AddParamButton onClick={() => openNewInput('file', selected.id)}>
                  <PlusIcon className={styles.iconPlus} /> file input
                </AddParamButton>
                <AddParamButton onClick={() => openNewInput('directory', selected.id)}>
                  <PlusIcon className={styles.iconPlus} /> dir input
                </AddParamButton>
                <AddParamButton onClick={() => openNewInput('string', selected.id)}>
                  <PlusIcon className={styles.iconPlus} /> string input
                </AddParamButton>
                <AddParamButton onClick={() => openNewInput('number', selected.id)}>
                  <PlusIcon className={styles.iconPlus} /> number input
                </AddParamButton>
              </div>
            </div>

            {/* Output parameters exposed as output ports */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <SectionTitle>Outputs</SectionTitle>
              </div>

              {outputParams.length > 0 && (
                <div className={styles.paramList}>
                  {outputParams.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={styles.paramChip}
                      onClick={() => openEdit(p)}
                      title="Click to edit"
                    >
                      <span className={styles.paramChipName}>{p.name}</span>
                      <span className={styles.paramChipSep}>:</span>
                      <span className={styles.paramChipValue}>
                        {p.value || '(auto path / empty)'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.addParamRow}>
                <AddParamButton onClick={() => openNewOutput('file', selected.id)}>
                  <PlusIcon className={styles.iconPlus} /> file output
                </AddParamButton>
                <AddParamButton onClick={() => openNewOutput('directory', selected.id)}>
                  <PlusIcon className={styles.iconPlus} /> dir output
                </AddParamButton>
                <AddParamButton onClick={() => openNewOutput('string', selected.id)}>
                  <PlusIcon className={styles.iconPlus} /> string output
                </AddParamButton>
                <AddParamButton onClick={() => openNewOutput('number', selected.id)}>
                  <PlusIcon className={styles.iconPlus} /> number output
                </AddParamButton>
              </div>
            </div>

            {/* Draft editor card for adding/editing a parameter */}
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
                            nodeId: selected.id,
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
                      onClick={() => saveDraft(selected.id)}
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
                    label="name"
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
                </div>
              </div>
            )}
          </section>

          {/* ---------------- ENVIRONMENT ---------------- */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <SectionTitle>Environment</SectionTitle>
            </div>

            <div className={styles.subTitle}>variables</div>

            {selected.task.environment.variables.length > 0 && (
              <div className={styles.paramList}>
                {selected.task.environment.variables.map((v) => (
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
              <button type="button" className={styles.addParamBtn} onClick={() => openNewVar(selected.id)}>
                <PlusIcon className={styles.iconPlus} /> variable
              </button>
            </div>

            {/* Draft editor for environment variables */}
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
                          dispatch({ type: 'task/envVarRemove', nodeId: selected.id, varId: editingVarId });
                        }
                        cancelVarDraft();
                      }}
                      title="Delete"
                    >
                      <TrashIcon className={styles.iconAction} />
                    </button>

                    <button type="button" className={styles.iconBtnOk} onClick={() => saveVarDraft(selected.id)} title="Save">
                      <CheckIcon className={styles.iconAction} />
                    </button>

                    <button type="button" className={styles.iconBtnCancel} onClick={cancelVarDraft} title="Cancel">
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
              items={selected.task.environment.modules}
              placeholder="e.g. gcc/12.2.0"
              onAdd={(txt) => dispatch({ type: 'task/moduleAdd', nodeId: selected.id, moduleName: txt })}
              onUpdate={(i, txt) => dispatch({ type: 'task/moduleUpdate', nodeId: selected.id, index: i, moduleName: txt })}
              onRemove={(i) => dispatch({ type: 'task/moduleRemove', nodeId: selected.id, index: i })}
            />

            <div className={styles.subTitle} style={{ marginTop: 12 }}>library paths</div>

            <SimpleStringList
              items={selected.task.environment.libraries}
              placeholder="e.g. /opt/lib"
              onAdd={(txt) => dispatch({ type: 'task/libraryAdd', nodeId: selected.id, library: txt })}
              onUpdate={(i, txt) => dispatch({ type: 'task/libraryUpdate', nodeId: selected.id, index: i, library: txt })}
              onRemove={(i) => dispatch({ type: 'task/libraryRemove', nodeId: selected.id, index: i })}
            />
          </section>

          {/* ---------------- BATCH ---------------- */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <SectionTitle>Batch</SectionTitle>
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>backend</span>
              <select
                className={styles.select}
                value={selected.task.batch.backend}
                onChange={(e) => {
                  const backend = e.target.value as 'local' | 'slurm' | 'pbs';
                  const patch = {
                    task: {
                      ...selected.task,
                      batch: {
                        ...selected.task.batch,
                        backend,
                        array: { ...(selected.task.batch.array ?? { enabled: false }), enabled: false },
                      },
                    },
                  } as Partial<WorkflowNode>;
                  dispatch({ type: 'node/update', nodeId: selected.id, patch });
                }}
              >
                <option value="local">local</option>
                <option value="slurm">slurm</option>
                <option value="pbs">pbs</option>
              </select>
            </label>

            {selected.task.batch.backend !== 'local' && (
              <>
                <div className={styles.grid2}>
                  <NumberInput
                    label="cpus"
                    value={selected.task.batch.cpus ?? ''}
                    onChange={(n) => {
                      const patch = {
                        task: { ...selected.task, batch: { ...selected.task.batch, cpus: n } },
                      } as Partial<WorkflowNode>;
                      dispatch({ type: 'node/update', nodeId: selected.id, patch });
                    }}
                  />

                  <NumberInput
                    label="mem (MB)"
                    value={selected.task.batch.memMB ?? ''}
                    onChange={(n) => {
                      const patch = {
                        task: { ...selected.task, batch: { ...selected.task.batch, memMB: n } },
                      } as Partial<WorkflowNode>;
                      dispatch({ type: 'node/update', nodeId: selected.id, patch });
                    }}
                  />

                  <NumberInput
                    label="time (min)"
                    value={selected.task.batch.timeMin ?? ''}
                    onChange={(n) => {
                      const patch = {
                        task: { ...selected.task, batch: { ...selected.task.batch, timeMin: n } },
                      } as Partial<WorkflowNode>;
                      dispatch({ type: 'node/update', nodeId: selected.id, patch });
                    }}
                  />

                  <LabeledInput
                    label={selected.task.batch.backend === 'slurm' ? 'partition' : 'queue'}
                    value={selected.task.batch.partitionOrQueue ?? ''}
                    onChange={(v) => {
                      const patch = {
                        task: { ...selected.task, batch: { ...selected.task.batch, partitionOrQueue: v } },
                      } as Partial<WorkflowNode>;
                      dispatch({ type: 'node/update', nodeId: selected.id, patch });
                    }}
                  />

                  <LabeledInput
                    label="account"
                    value={selected.task.batch.account ?? ''}
                    onChange={(v) => {
                      const patch = {
                        task: { ...selected.task, batch: { ...selected.task.batch, account: v } },
                      } as Partial<WorkflowNode>;
                      dispatch({ type: 'node/update', nodeId: selected.id, patch });
                    }}
                  />

                  <LabeledInput
                    label="qos"
                    value={selected.task.batch.qos ?? ''}
                    onChange={(v) => {
                      const patch = {
                        task: { ...selected.task, batch: { ...selected.task.batch, qos: v } },
                      } as Partial<WorkflowNode>;
                      dispatch({ type: 'node/update', nodeId: selected.id, patch });
                    }}
                  />
                </div>

                <TextAreaInput
                  label="custom (slurm / pbs)"
                  value={selected.task.batch.custom ?? ''}
                  onChange={(v) => {
                    const patch = {
                      task: {
                        ...selected.task,
                        batch: {
                          ...selected.task.batch,
                          custom: v,
                        },
                      },
                    } as Partial<WorkflowNode>;
                    dispatch({ type: 'node/update', nodeId: selected.id, patch });
                  }}
                  placeholder={`# custom commands`}
                />

                {/* Array job settings */}
                <div className={styles.arrayBox}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={selected.task.batch.array?.enabled ?? false}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        const current = selected.task.batch.array ?? { enabled: false };
                        const patch = {
                          task: {
                            ...selected.task,
                            batch: {
                              ...selected.task.batch,
                              array: { ...current, enabled },
                            },
                          },
                        } as Partial<WorkflowNode>;
                        dispatch({ type: 'node/update', nodeId: selected.id, patch });
                      }}
                    />
                    <span>array job</span>
                  </label>

                  {selected.task.batch.array?.enabled && (
                    <div className={styles.grid2}>
                      <NumberInput
                        label="start"
                        value={selected.task.batch.array.start ?? ''}
                        onChange={(n) => {
                          const a = selected.task.batch.array ?? { enabled: true };
                          const patch = {
                            task: { ...selected.task, batch: { ...selected.task.batch, array: { ...a, start: n } } },
                          } as Partial<WorkflowNode>;
                          dispatch({ type: 'node/update', nodeId: selected.id, patch });
                        }}
                      />
                      <NumberInput
                        label="end"
                        value={selected.task.batch.array.end ?? ''}
                        onChange={(n) => {
                          const a = selected.task.batch.array ?? { enabled: true };
                          const patch = {
                            task: { ...selected.task, batch: { ...selected.task.batch, array: { ...a, end: n } } },
                          } as Partial<WorkflowNode>;
                          dispatch({ type: 'node/update', nodeId: selected.id, patch });
                        }}
                      />
                      <NumberInput
                        label="step"
                        value={selected.task.batch.array.step ?? ''}
                        onChange={(n) => {
                          const a = selected.task.batch.array ?? { enabled: true };
                          const patch = {
                            task: { ...selected.task, batch: { ...selected.task.batch, array: { ...a, step: n } } },
                          } as Partial<WorkflowNode>;
                          dispatch({ type: 'node/update', nodeId: selected.id, patch });
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* ---------------- PRESETS ---------------- */}
          <section className={styles.section}>
            <button
              type="button"
              className={styles.exportPreset}
              onClick={() => {
                if (selected.type !== 'task') return;
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


/**
 * Small title component used for section headings in the properties panel.
 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className={styles.sectionTitle}>{children}</div>;
}


/**
 * Reusable button used for adding new parameters.
 */
function AddParamButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={styles.addParamBtn}>
      {children}
    </button>
  );
}


/**
 * Specialized boolean select input.
 * Keeps bool values consistent as "true" / "false".
 */
function BoolSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        value={value === 'false' ? 'false' : 'true'}
        onChange={(e) => onChange(e.target.value)}
        className={styles.select}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </label>
  );
}


/**
 * Reusable labeled text input.
 */
function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={styles.input} />
    </label>
  );
}


/**
 * JSON tab showing the full workflow document.
 * Mainly useful for debugging and quick inspection.
 */
function JsonView() {
  const { state } = useWorkflowState();
  return (
    <div className={styles.jsonBox}>
      <pre className={styles.pre}>{JSON.stringify(state.workflow, null, 2)}</pre>
    </div>
  );
}


/**
 * Simple editable list of strings.
 *
 * Used for:
 * - module names
 * - library paths
 */
function SimpleStringList({
  items,
  placeholder,
  onAdd,
  onUpdate,
  onRemove,
}: {
  items: string[];
  placeholder: string;
  onAdd: (txt: string) => void;
  onUpdate: (index: number, txt: string) => void;
  onRemove: (index: number) => void;
}) {
  const [draft, setDraft] = useState('');

  return (
    <div className={styles.simpleList}>
      {items.map((it, i) => (
        <div key={`${it}_${i}`} className={styles.simpleRow}>
          <input
            className={styles.input}
            value={it}
            onChange={(e) => onUpdate(i, e.target.value)}
          />
          <button type="button" className={styles.simpleRemove} onClick={() => onRemove(i)} title="Remove">
            <XMarkIcon className={styles.iconAction} />
          </button>
        </div>
      ))}

      <div className={styles.simpleAddRow}>
        <input
          className={styles.input}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className={styles.simpleAdd}
          onClick={() => {
            const v = draft.trim();
            if (!v) return;
            onAdd(v);
            setDraft('');
          }}
          title="Add"
        >
          <PlusIcon className={styles.iconPlus} />
        </button>
      </div>
    </div>
  );
}


/**
 * Numeric input that converts user input into number | undefined.
 * Empty value is treated as undefined.
 */
function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | '';
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        inputMode="numeric"
        value={value === '' ? '' : String(value)}
        onChange={(e) => {
          const t = e.target.value.trim();
          if (t === '') return onChange(undefined);
          const n = Number(t);
          if (!Number.isFinite(n)) return;
          onChange(n);
        }}
        placeholder="—"
      />
    </label>
  );
}


/**
 * Reusable textarea input.
 * Used mainly for larger free-form text fields.
 */
function TextAreaInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <textarea
        className={styles.textarea}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
      />
    </label>
  );
}


/**
 * Download arbitrary data as formatted JSON file.
 * Used here for exporting node presets.
 */
function downloadJson(filename: string, data: unknown) {
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