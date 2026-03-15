/**
 * @file LeftPanel.tsx
 * @brief Sidebar panel for creating nodes and importing task presets.
 * @author Silvia Šlachtovská
 *
 * The left panel provides simple tools for adding new workflow nodes.
 * Currently it supports:
 *
 * - drag & drop creation of a new task node
 * - importing task presets from JSON
 *
 * Presets allow users to reuse predefined task configurations.
 */

import { useRef } from 'react';
import { useWorkflowState } from '../state/workflowState';
import styles from './LeftPanel.module.css';
import type { TaskNodePreset } from '../state/model';
import { createTaskNodeFromPreset, isTaskNodePreset } from '../state/nodePresets';
import toast from 'react-hot-toast';


/**
 * Sidebar component used for workflow editing tools.
 */
export function LeftPanel() {

  const { dispatch } = useWorkflowState();

  const fileRef = useRef<HTMLInputElement | null>(null);


  /**
   * Trigger hidden file input for importing a preset.
   */
  function onImportPresetClick() {
    fileRef.current?.click();
  }


  /**
   * Import task preset from JSON file.
   * If valid, a new task node is created from the preset.
   */
  async function onImportPresetFile(e: React.ChangeEvent<HTMLInputElement>) {

    const file = e.target.files?.[0];
    if (!file) return;

    try {

      const text = await file.text();
      const json = JSON.parse(text);

      if (!isTaskNodePreset(json)) {
        toast.error('Invalid task preset file.');
        return;
      }

      const newNode = createTaskNodeFromPreset(
        json as TaskNodePreset,
        { x: 140, y: 140 }
      );

      dispatch({ type: 'node/addPresetNode', node: newNode });

      toast.success('Node preset imported.');

    } catch (err) {

      console.error(err);
      toast.error('Could not import preset.');

    } finally {
      e.target.value = '';
    }
  }


  return (
    <div className={styles.root}>

      {/* panel header (currently empty, reserved for future controls) */}
      <div className={styles.header}></div>


      {/* node creation section */}
      <div className={styles.nodes}>

        {/* draggable card used to create a new task node */}
        <div
          className={styles.nodeCard}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/reactflow', 'task');
            e.dataTransfer.effectAllowed = 'move';
          }}
        >
          + Task Node
        </div>


        {/* import task preset button */}
        <button
          type="button"
          className={styles.nodeCardButton}
          onClick={onImportPresetClick}
        >
          Import Task Preset
        </button>


        {/* hidden file input for preset import */}
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={onImportPresetFile}
          className={styles.hiddenFile}
        />

      </div>
    </div>
  );
}