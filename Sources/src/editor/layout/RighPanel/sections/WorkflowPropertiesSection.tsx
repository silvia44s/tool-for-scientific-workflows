/**
 * @file WorkflowPropertiesSection.tsx
 * @brief Section in the right panel showing properties for the entire workflow. 
 * @author Silvia Šlachtovská
 *
 */

import styles from '../../RightPanel.module.css';
import {
  SectionTitle,
  LabeledInput,
} from '../rightPanelFormParts';
import type { State, Action } from '../../../state/workflowReducer';

export function WorkflowPropertiesSection({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
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

        <label className={styles.field}>
          <span className={styles.fieldLabel}>backend</span>
          <select
            className={styles.select}
            value={state.workflow.run?.backend ?? 'local'}
            onChange={(e) =>
              dispatch({
                type: 'workflow/setBackend',
                backend: e.target.value as 'local' | 'slurm' | 'pbs',
              })
            }
          >
            <option value="local">local</option>
            <option value="slurm">slurm</option>
            <option value="pbs">pbs</option>
          </select>
        </label>

        <div className={styles.hintText}>
          Execution backend used to run the entire workflow.
        </div>
      </section>

      <div className={styles.placeholder}>
        No node selected. Click a node to edit it.
      </div>
    </div>
  );
}