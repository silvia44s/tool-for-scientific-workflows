/**
 * @file TopBarModals.tsx
 * @brief Renders modal dialogs used by the workflow editor top bar.
 * @author Silvia Šlachtovská
 */

import styles from './TopBar.module.css';
import type { RunErrorInfo, SubmitPromptInfo } from './topBarTypes';
import { useState } from 'react';

type TopBarModalsProps = {
  runError: RunErrorInfo | null;
  setRunError: React.Dispatch<React.SetStateAction<RunErrorInfo | null>>;
  submitPrompt: SubmitPromptInfo | null;
  setSubmitPrompt: React.Dispatch<React.SetStateAction<SubmitPromptInfo | null>>;
  isSubmitting: boolean;
  onUploadBatch: () => void;
  onDownloadScripts: () => void;

  remoteHost: string;
  setRemoteHost: React.Dispatch<React.SetStateAction<string>>;
  remoteUser: string;
  setRemoteUser: React.Dispatch<React.SetStateAction<string>>;
  remotePath: string;
  setRemotePath: React.Dispatch<React.SetStateAction<string>>;
  remoteKeyPath: string;
  setRemoteKeyPath: React.Dispatch<React.SetStateAction<string>>;
  remoteKeyPassphrase: string;
  setRemoteKeyPassphrase: React.Dispatch<React.SetStateAction<string>>;

  isNewModalOpen: boolean;
  setIsNewModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onImportJson: () => void;
  onStartEmpty: () => void;
};

/**
 * @brief Displays all modals used by the top bar.
 *
 * This includes:
 * - workflow execution error dialog,
 * - batch submission prompt,
 * - confirmation dialog for creating a new workflow.
 *
 * @param props Modal state values and handlers.
 * @return JSX fragment containing top bar modal dialogs.
 */
export function TopBarModals({
  runError,
  setRunError,
  submitPrompt,
  setSubmitPrompt,
  isSubmitting,
  onUploadBatch,
  onDownloadScripts,
  remoteHost,
  setRemoteHost,
  remoteUser,
  setRemoteUser,
  remotePath,
  setRemotePath,
  remoteKeyPath,
  setRemoteKeyPath,
  remoteKeyPassphrase,
  setRemoteKeyPassphrase,
  isNewModalOpen,
  setIsNewModalOpen,
  onImportJson,
  onStartEmpty,
}: TopBarModalsProps) {
  const [showRemoteUploadForm, setShowRemoteUploadForm] = useState(false);
  return (
    <>
      {runError && (
        <div className={styles.modalOverlay} onClick={() => setRunError(null)}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{runError.title}</h3>

              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setRunError(null)}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalMessage}>{runError.message}</p>

              {runError.returncode !== null && runError.returncode !== undefined && (
                <div className={styles.modalMeta}>
                  <strong>Return code:</strong> {runError.returncode}
                </div>
              )}

              {runError.runDir && (
                <div className={styles.modalMeta}>
                  <strong>Run dir:</strong> {runError.runDir}
                </div>
              )}

              {runError.stderr && (
                <>
                  <div className={styles.modalSectionLabel}>stderr</div>
                  <pre className={styles.modalPre}>{runError.stderr}</pre>
                </>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalOkBtn}
                onClick={() => setRunError(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {submitPrompt && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (!isSubmitting) {
              setShowRemoteUploadForm(false);
              setSubmitPrompt(null);
            }
          }}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {submitPrompt.backend.toUpperCase()} scripts ready
              </h3>

              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => {
                  if (!isSubmitting) {
                    setShowRemoteUploadForm(false);
                    setSubmitPrompt(null);
                  }
                }}
                disabled={isSubmitting}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalMessage}>
                Workflow scripts were generated successfully.
                <br />
                You can download them or upload them to a remote server.
              </p>

              {/*<div className={styles.modalMeta}>
                <strong>Run dir:</strong> {submitPrompt.runDir}
              </div>*/}

              {showRemoteUploadForm && (
              <>
              <div className={styles.modalSectionLabel}>Remote upload</div>

              <div className={styles.modalFieldsSection}>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Hostname</label>
                  <input
                    className={styles.modalInput}
                    type="text"
                    value={remoteHost}
                    onChange={(e) => setRemoteHost(e.target.value)}
                    placeholder="e.g. merlin.fit.vutbr.cz"
                    disabled={isSubmitting}
                  />
                </div>

                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Username</label>
                  <input
                    className={styles.modalInput}
                    type="text"
                    value={remoteUser}
                    onChange={(e) => setRemoteUser(e.target.value)}
                    placeholder="e.g. loginxx"
                    disabled={isSubmitting}
                  />
                </div>

                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Remote path</label>
                  <input
                    className={styles.modalInput}
                    type="text"
                    value={remotePath}
                    onChange={(e) => setRemotePath(e.target.value)}
                    placeholder="e.g. /home/user/workflow_runs"
                    disabled={isSubmitting}
                  />
                </div>

                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>SSH key path</label>
                  <input
                    className={styles.modalInput}
                    type="text"
                    value={remoteKeyPath}
                    onChange={(e) => setRemoteKeyPath(e.target.value)}
                    placeholder="e.g. /home/user/.ssh/id_ed25519"
                    disabled={isSubmitting}
                  />
                </div>

                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Key passphrase</label>
                  <input
                    className={styles.modalInput}
                    type="password"
                    value={remoteKeyPassphrase}
                    onChange={(e) => setRemoteKeyPassphrase(e.target.value)}
                    placeholder="Enter key passphrase"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              </>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalClsBtn}
                onClick={() => setSubmitPrompt(null)}
                disabled={isSubmitting}
              >
                Close
              </button>

              <button
                type="button"
                className={styles.modalOkBtn}
                onClick={onDownloadScripts}
                disabled={isSubmitting}
              >
                Download scripts
              </button>

              {showRemoteUploadForm ? (
                <button
                  type="button"
                  className={styles.modalOkBtn}
                  onClick={onUploadBatch}
                  disabled={
                    isSubmitting ||
                    !remoteHost.trim() ||
                    !remoteUser.trim() ||
                    !remotePath.trim()
                  }
                >
                  {isSubmitting ? 'UPLOADING...' : 'Upload to remote server'}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.modalOkBtn}
                  onClick={() => setShowRemoteUploadForm(true)}
                  disabled={isSubmitting}
                >
                  Remote upload
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isNewModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsNewModalOpen(false)}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Create new workflow</h3>

              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setIsNewModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalMessage}>
                Your current workflow will be replaced. Choose how you want to continue.
              </p>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalClsBtn}
                onClick={() => setIsNewModalOpen(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.modalOkBtn}
                onClick={onImportJson}
              >
                Import JSON
              </button>

              <button
                type="button"
                className={styles.modalOkBtn}
                onClick={onStartEmpty}
              >
                Start empty
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}