/**
 * @file JsonView.tsx
 * @brief Displays the current workflow in JSON format.
 * @author Silvia Šlachtovská
 *
 * This component renders a formatted JSON representation of the workflow state,
 * allowing users to inspect the structure of the workflow graph.
 */

import styles from './RightPanel.module.css';
import { useWorkflow } from '../../provider/useWorkflow';

/**
 * @brief JSON tab showing the full workflow document.
 *
 */
export function JsonView() {
  const { state } = useWorkflow();

  return (
    <div className={styles.jsonBox}>
      <pre className={styles.pre}>{JSON.stringify(state.workflow, null, 2)}</pre>
    </div>
  );
}