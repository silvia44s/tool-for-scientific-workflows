/**
 * @file RightPanel.tsx
 * @brief Container component for the right sidebar of the workflow editor.
 * @author Silvia Šlachtovská
 *
 * Provides a tab-based interface that allows switching between:
 * - a JSON representation of the workflow
 * - a properties editor for the workflow or selected nodes
 */

import { useState } from 'react';
import styles from './RightPanel.module.css';
import { PropertiesView } from './PropertiesView';
import { JsonView } from './JsonView';

type TabKey = 'json' | 'properties';


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