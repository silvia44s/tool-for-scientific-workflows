/**
 * @file MultiSelectionView.tsx
 * @brief Displays information for multiple selected nodes.
 * @author Silvia Šlachtovská
 *
 * This component is shown when multiple nodes are selected in the workflow editor.
 */
import styles from '../RightPanel.module.css';
import { SectionTitle } from '../formFields';
import type { WorkflowNode } from '../../../../../domain/workflow/model/model';

export function MultiSelectionView({ selectedNodes }: { selectedNodes: WorkflowNode[] }) {
  const taskOnly = selectedNodes.every((node) => node.type === 'task');

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