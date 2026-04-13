/**
 * @file EditorLayout.tsx
 * @brief Basic layout container for the workflow editor.
 * @author Silvia Šlachtovská
 *
 * This component defines the main page structure used in the editor.
 * It arranges the UI into three areas:
 * - left sidebar
 * - central canvas area
 * - right sidebar for settings or details
 *
 */

import styles from './EditorLayout.module.css';

type Props = {
  center: React.ReactNode;
  right: React.ReactNode;
};

/**
 * @brief Layout component used to organize the main editor UI.
 *
 * It renders three regions:
 * - left panel 
 * - center workspace
 * - right panel
 *
 * @param left Content rendered in the left sidebar.
 * @param center Main content area.
 * @param right Content rendered in the right sidebar.
 */
export function EditorLayout({ center, right }: Props) {
  return (
    <div className={styles.root}>
      <main className={styles.center}>{center}</main>
      <aside className={styles.right}>{right}</aside>
    </div>
  );
}