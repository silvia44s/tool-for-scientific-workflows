/**
 * @file SubworkflowPropertiesView.tsx
 * @brief Properties editor for subworkflow nodes.
 * @author Silvia Šlachtovská
 *
 * Allows seeing properties specific to subworkflow nodes,
 * including nested workflow structure and exposed ports.
 */
import styles from '../RightPanel.module.css';
import type { Action } from '../../../../../domain/workflow/model/actions';
import type { SubworkflowNode, WorkflowNode } from '../../../../../domain/workflow/model/model';
import { LabeledInput } from '../formFields';
import { SubworkflowPropertiesSection } from '../sections/subworkflow/SubworkflowPropertiesSection';

export function SubworkflowPropertiesView({
  node,
  dispatch,
}: {
  node: SubworkflowNode;
  dispatch: React.Dispatch<Action>;
}) {
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

      <section className={styles.section}>
        <LabeledInput
          label="description"
          value={node.description ?? ''}
          onChange={(value) =>
            dispatch({
              type: 'node/update',
              nodeId: node.id,
              patch: { description: value } as Partial<WorkflowNode>,
            })
          }
        />
      </section>

      <SubworkflowPropertiesSection node={node} />
    </div>
  );
}