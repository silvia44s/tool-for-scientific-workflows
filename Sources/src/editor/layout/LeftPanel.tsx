import { useEffect, useRef, useState } from 'react';
import styles from './LeftPanel.module.css';
import { useWorkflowState } from '../state/workflowState';
import type { TaskNodePreset, WorkflowNode } from '../state/model';
import {
  isTaskNodePreset,
  loadStoredTaskPresets,
  addStoredTaskPreset,
  removeStoredTaskPreset,
  createTaskNodeFromPreset,
} from '../state/nodePresets';
import toast from 'react-hot-toast';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';

import {
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline';

export function LeftPanel() {
  const { dispatch } = useWorkflowState();

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [presets, setPresets] = useState<TaskNodePreset[]>([]);

  const [bulkPreset, setBulkPreset] = useState<TaskNodePreset | null>(null);
  const [bulkAmount, setBulkAmount] = useState('3');

  useEffect(() => {
    setPresets(loadStoredTaskPresets());
  }, []);

  function onImportPresetClick() {
    fileRef.current?.click();
  }

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

  function onDeletePreset(presetName: string) {
    const updated = removeStoredTaskPreset(presetName);
    setPresets(updated);
    toast.success(`Preset "${presetName}" removed.`);
  }

  function insertPresetOnce(preset: TaskNodePreset) {
    const newNode = createTaskNodeFromPreset(preset, { x: 140, y: 140 });

    dispatch({ type: 'node/addPresetNode', node: newNode });
    toast.success(`Preset "${preset.presetName}" added.`);
  }

  function createPresetNodesInGrid(
    preset: TaskNodePreset,
    count: number
  ): WorkflowNode[] {
    const startX = 140;
    const startY = 140;
    const colWidth = 220;
    const rowHeight = 140;
    const cols = 3;

    return Array.from({ length: count }, (_, i) => {
      const position = {
        x: startX + (i % cols) * colWidth,
        y: startY + Math.floor(i / cols) * rowHeight,
      };

      return createTaskNodeFromPreset(preset, position);
    });
  }

  function insertPresetMultiple() {
    if (!bulkPreset) return;

    const amount = Number.parseInt(bulkAmount, 10);

    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error('Amount must be a positive integer.');
      return;
    }

    /*if (amount > 50) {
      toast.error('Please choose 50 copies or fewer.');
      return;
    }*/

    const t0 = performance.now();

    const nodes = createPresetNodesInGrid(bulkPreset, amount);

    const t1 = performance.now();

    dispatch({ type: 'node/addMany', nodes });

    /*toast.success(
      amount === 1
        ? `Preset "${bulkPreset.presetName}" added.`
        : `${amount} copies of "${bulkPreset.presetName}" added.`
    );*/

    console.log(`Inserted ${amount} nodes in ${(t1 - t0).toFixed(2)} ms`);

    setBulkPreset(null);
    setBulkAmount('3');
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

      <Dialog.Root
        open={bulkPreset !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBulkPreset(null);
            setBulkAmount('3');
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.dialogOverlay} />
          <Dialog.Content className={styles.dialogContent}>
            <Dialog.Title className={styles.dialogTitle}>
              Insert multiple preset nodes
            </Dialog.Title>

            <Dialog.Description className={styles.dialogDescription}>
              {bulkPreset
                ? `How many copies of "${bulkPreset.presetName}" would you like to insert?`
                : ''}
            </Dialog.Description>

            <div className={styles.dialogField}>
              <label htmlFor="preset-amount" className={styles.dialogLabel}>
                Amount
              </label>

              <input
                id="preset-amount"
                type="number"
                min={1}
                max={50}
                step={1}
                value={bulkAmount}
                onChange={(e) => setBulkAmount(e.target.value)}
                className={styles.dialogInput}
              />
            </div>

            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogCancelBtn}
                onClick={() => {
                  setBulkPreset(null);
                  setBulkAmount('3');
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.dialogOkBtn}
                onClick={insertPresetMultiple}
              >
                Insert
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}