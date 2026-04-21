/**
 * @file LeftPanel.tsx
 * @brief Left sidebar of the workflow editor used for inserting task nodes and managing task presets.
 * @author Silvia Šlachtovská
 *
 * This panel allows the user to:
 * - drag a default task node onto the canvas,
 * - import task presets from JSON files,
 * - insert stored presets into the workflow,
 * - remove stored presets,
 * - insert multiple copies of a selected preset.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './LeftPanel.module.css';
import { useWorkflow } from '../../provider/useWorkflow';

import type { TaskNodePreset } from '../../../../domain/workflow/model/model';
import {
  isTaskNodePreset,
  createTaskNodeFromPreset,
} from '../../../../domain/workflow/operations/taskPresets';
import {
  loadStoredTaskPresets,
  addStoredTaskPreset,
  removeStoredTaskPreset,
} from '../../provider/taskPresetStorage';
import toast from 'react-hot-toast';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import {
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline';

import { PresetBulkInsertDialog } from './PresetBulkInsertDialog';
import { createPresetNodesInGrid } from './leftPanelUtils';

/**
 * @brief Renders the left panel of the workflow editor.
 *
 * The component displays the default task node card, a list of stored task presets,
 * and actions for importing, inserting, and removing presets. It also manages
 * the dialog for bulk insertion of preset-based nodes.
 *
 * @return JSX element representing the left editor panel.
 */
export function LeftPanel() {
  const { dispatch } = useWorkflow();

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [presets, setPresets] = useState<TaskNodePreset[]>([]);

  const [bulkPreset, setBulkPreset] = useState<TaskNodePreset | null>(null);
  const [bulkAmount, setBulkAmount] = useState('3');

  /**
   * @brief Loads stored task presets from local storage after component mount.
   */
  useEffect(() => {
    setPresets(loadStoredTaskPresets());
  }, []);

  /**
   * @brief Opens the hidden file input used for importing task presets.
   */
  function onImportPresetClick() {
    fileRef.current?.click();
  }

  /**
   * @brief Imports a task preset from a selected JSON file.
   *
   * The file is parsed and validated before being saved into local storage.
   *
   * @param e File input change event.
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

      const updated = addStoredTaskPreset(json);
      setPresets(updated);

      toast.success(`Preset "${json.presetName}" imported.`);
    } catch (err) {
      console.error(err);
      toast.error('Could not import preset.');
    } finally {
      e.target.value = '';
    }
  }

  /**
   * @brief Removes a stored task preset by name.
   *
   * @param presetName Name of the preset to remove.
   */
  function onDeletePreset(presetName: string) {
    const updated = removeStoredTaskPreset(presetName);
    setPresets(updated);
    toast.success(`Preset "${presetName}" removed.`);
  }

  /**
   * @brief Inserts a single task node created from the selected preset.
   *
   * @param preset Preset used to create the new task node.
   */
  function insertPresetOnce(preset: TaskNodePreset) {
    const newNode = createTaskNodeFromPreset(preset, { x: 140, y: 140 });

    dispatch({ type: 'node/addPresetNode', node: newNode });
    toast.success(`Preset "${preset.presetName}" added.`);
  }

  /**
   * @brief Resets the bulk insert dialog state.
   *
   * Clears the selected preset and restores the default amount value.
   */
  function resetBulkDialog() {
    setBulkPreset(null);
    setBulkAmount('3');
  }

  /**
   * @brief Inserts multiple copies of the selected preset into the workflow.
   *
   * Validates the requested amount, generates the corresponding nodes,
   * dispatches them into the workflow, and closes the bulk insert dialog.
   */
  function insertPresetMultiple() {
    if (!bulkPreset) return;

    const amount = Number.parseInt(bulkAmount, 10);

    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error('Amount must be a positive integer.');
      return;
    }

    if (amount > 50) {
      toast.error('Please choose 50 copies or fewer.');
      return;
    }

    const nodes = createPresetNodesInGrid(bulkPreset, amount);

    dispatch({ type: 'node/addMany', nodes });

    toast.success(
      amount === 1
        ? `Preset "${bulkPreset.presetName}" added.`
        : `${amount} copies of "${bulkPreset.presetName}" added.`
    );

    resetBulkDialog();
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}></div>

      <div className={styles.nodes}>
        <div
          className={styles.nodeCard}
          title="Drag preset task node onto canvas"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/reactflow', 'task');
            e.dataTransfer.effectAllowed = 'move';
          }}
        >
          Task Node
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={onImportPresetFile}
          className={styles.hiddenFile}
        />

        {presets.length > 0 && (
          <div className={styles.presetsSection}>
            {presets.map((preset) => (
              <div
                key={preset.presetName}
                className={styles.presetCard}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'taskPreset');
                  e.dataTransfer.setData(
                    'application/task-preset',
                    JSON.stringify(preset)
                  );
                  e.dataTransfer.effectAllowed = 'move';
                }}
                title={`Drag preset "${preset.presetName}" onto canvas`}
              >
                <div className={styles.presetName}>{preset.presetName}</div>

                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      className={styles.presetMenuBtn}
                      onClick={(e) => e.stopPropagation()}
                      title="Preset actions"
                    >
                      <EllipsisHorizontalIcon className={styles.menuIcon} />
                    </button>
                  </DropdownMenu.Trigger>

                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className={styles.dropdownContent}
                      sideOffset={8}
                    >
                      <DropdownMenu.Item
                        className={styles.dropdownItem}
                        onSelect={() => insertPresetOnce(preset)}
                      >
                        Insert once
                      </DropdownMenu.Item>

                      <DropdownMenu.Item
                        className={styles.dropdownItem}
                        onSelect={() => {
                          setBulkPreset(preset);
                          setBulkAmount('3');
                        }}
                      >
                        Insert multiple...
                      </DropdownMenu.Item>

                      <DropdownMenu.Separator className={styles.dropdownSeparator} />

                      <DropdownMenu.Item
                        className={`${styles.dropdownItem} ${styles.dropdownDanger}`}
                        onSelect={() => onDeletePreset(preset.presetName)}
                      >
                        Delete
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className={styles.nodeCardButton}
          onClick={onImportPresetClick}
          title="Import preset from JSON"
        >
          Import Task Preset
        </button>
      </div>

      <PresetBulkInsertDialog
        bulkPreset={bulkPreset}
        bulkAmount={bulkAmount}
        setBulkAmount={setBulkAmount}
        onClose={resetBulkDialog}
        onConfirm={insertPresetMultiple}
      />
    </div>
  );
}