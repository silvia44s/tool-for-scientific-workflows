import styles from '../RightPanel.module.css';
import { useWorkflowState } from '../../state/workflowState';

/**
 * @brief JSON tab showing the full workflow document.
 *
 * Mainly useful for debugging and quick inspection.
 */
export function JsonView() {
  const { state } = useWorkflowState();

  return (
    <div className={styles.jsonBox}>
      <pre className={styles.pre}>{JSON.stringify(state.workflow, null, 2)}</pre>
    </div>
  );
}