/**
 * @file PresetBulkInsertDialog.tsx
 * @brief Dialog for inserting multiple copies of a selected task preset.
 * @author Silvia Šlachtovská
 */

import * as Dialog from '@radix-ui/react-dialog';
import styles from './LeftPanel.module.css';
import type { TaskNodePreset } from '../../../../domain/workflow/model/model';

type PresetBulkInsertDialogProps = {
  bulkPreset: TaskNodePreset | null;
  bulkAmount: string;
  setBulkAmount: React.Dispatch<React.SetStateAction<string>>;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * @brief Displays a dialog for bulk insertion of task preset nodes.
 *
 * @param props Dialog state and action handlers.
 * @return JSX element representing the bulk insert dialog.
 */
export function PresetBulkInsertDialog({
  bulkPreset,
  bulkAmount,
  setBulkAmount,
  onClose,
  onConfirm,
}: PresetBulkInsertDialogProps) {
  return (
    <Dialog.Root
      open={bulkPreset !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
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
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="button"
              className={styles.dialogOkBtn}
              onClick={onConfirm}
            >
              Insert
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}