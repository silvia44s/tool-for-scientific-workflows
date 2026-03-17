import { useState } from 'react';
import styles from '../RightPanel.module.css';
import { PropertiesView } from './PropertiesView';
import { JsonView } from './JsonView';

type TabKey = 'json' | 'properties';

/**
 * @file RightPanel.tsx
 * @brief Right sidebar for workflow and node editing.
 *
 * This panel has two main views:
 * - JSON view showing the whole workflow document
 * - Properties view used to edit workflow settings or the selected node
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