/**
 * @file EditorLayout.tsx
 * @brief Layout container for the workflow editor page structure.
 * @author Silvia Šlachtovská
 *
 * This component defines the main layout used in the workflow editor.
 * It organizes the UI into two primary regions:
 * - central workspace (canvas area)
 * - right sidebar for properties and details
 *
 * The left panel is handled outside of this component.
 */

import styles from './EditorLayout.module.css';

type Props = {
  /** Main content area (typically the workflow canvas). */
  center: React.ReactNode;

  /** Content rendered in the right sidebar (e.g., properties panel). */
  right: React.ReactNode;
};

/**
 * @brief Renders the main layout structure of the editor.
 *
 * This component is responsible for positioning the central workspace
 * and the right sidebar. It does not include the left panel, which is
 * composed at a higher level of the application.
 *
 * @param center Main editor content.
 * @param right Right sidebar content.
 * @return JSX layout container for the editor.
 */
export function EditorLayout({ center, right }: Props) {
  return (
    <div className={styles.root}>
      <main className={styles.center}>{center}</main>
      <aside className={styles.right}>{right}</aside>
    </div>
  );
}