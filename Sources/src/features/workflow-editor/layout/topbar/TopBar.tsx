/**
 * @file TopBar.tsx
 * @brief Toolbar component for main workflow actions.
 * @author Silvia Šlachtovská
 *
 * The TopBar provides quick access to common editor operations:
 *
 * - delete selected node or edge
 * - export workflow to JSON
 * - import workflow from JSON
 * - run workflow using the backend API
 *
 */

import { useRef, useState } from 'react';
import styles from './TopBar.module.css';
import { useWorkflow } from '../../provider/useWorkflow';
import {
  getActiveWorkflow,
  createInitialWorkflow,
} from '../../../../domain/workflow/operations/workflowTree';
import toast from 'react-hot-toast';

import {
  TrashIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
} from '@heroicons/react/24/outline';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import type { RunErrorInfo, SubmitPromptInfo } from './topBarTypes';
import { downloadJson, downloadScriptsZip } from './topBarUtils';
import { useTopBarShortcuts } from './useTopBarShortcuts';
import { TopBarModals } from './TopBarModals';

import {
  parseWorkflowImport,
  getWorkflowImportErrorMessage,
} from '../../../../validator/workflowImport';

import { exportWorkflowAsCwl } from '../../../../export/cwl';
import { downloadCwlBundleZip } from '../../../../export/cwl/downloadBundle';

/**
 * @brief Main toolbar component displayed above the workflow canvas.
 */
export function TopBar() {
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runError, setRunError] = useState<RunErrorInfo | null>(null);
  const [submitPrompt, setSubmitPrompt] = useState<SubmitPromptInfo | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const [remoteHost, setRemoteHost] = useState('');
  const [remoteUser, setRemoteUser] = useState('');
  const [remotePath, setRemotePath] = useState('');
  const [remoteKeyPath, setRemoteKeyPath] = useState('');
  const [remoteKeyPassphrase, setRemoteKeyPassphrase] = useState('');

  const { state, dispatch, canUndo, canRedo, isDirty, markSaved } = useWorkflow();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);

  const hasSelection = state.selectedNodeIds.length > 0 || !!state.selectedEdgeId;

  const selectedNodes = state.selectedNodeIds
    .map((id) => activeWorkflow.nodes[id])
    .filter(Boolean);

  const canGroupSelection =
    selectedNodes.length >= 2 &&
    selectedNodes.every((n) => n.type === 'task');

  const canUngroupSelection =
    selectedNodes.length === 1 &&
    selectedNodes[0]?.type === 'subworkflow';

  function startNewWorkflow() {
    dispatch({
      type: 'workflow/replace',
      workflow: createInitialWorkflow(),
    });

    markSaved();
    setSubmitPrompt(null);
    setRunError(null);
    setIsNewModalOpen(false);
    toast.success('New workflow created');
  }

  function onNewClick() {
    if (isDirty) {
      setIsNewModalOpen(true);
      return;
    }

    startNewWorkflow();
  }

  /**
   * @brief Export current workflow as a JSON file.
   */
  function onSaveAsJson() {
    downloadJson(`${state.workflow.name || 'workflow'}.json`, state.workflow);
    markSaved();
    toast.success('Workflow saved as JSON');
  }

  /**
   * @brief Export current workflow as CWL zip bundle.
   */
  async function onSaveAsCwl() {
    const result = exportWorkflowAsCwl(state.workflow);

    if (!result.ok) {
      toast.error(result.diagnostics[0]?.message ?? 'CWL export failed');
      return;
    }

    try {
      await downloadCwlBundleZip(
        result.bundle,
        `${state.workflow.name || 'workflow'}_cwl.zip`
      );
      toast.success('CWL zip exported');
    } catch {
      toast.error('Failed to download CWL bundle');
    }
  }

  /**
   * @brief Open hidden file input for workflow import.
   */
  function onImportClick() {
    fileRef.current?.click();
  }

  /**
   * @brief Handle workflow import from a JSON file.
   *
   * @param e File input change event.
   */
  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      const text = await f.text();
      const workflow = parseWorkflowImport(text);

      dispatch({ type: 'workflow/replace', workflow });
      markSaved();
      setSubmitPrompt(null);
      setIsNewModalOpen(false);
      toast.success('Workflow imported');
    } catch (error) {
      toast.error(getWorkflowImportErrorMessage(error));
    } finally {
      e.target.value = '';
    }
  }

  /**
   * @brief Displays a toast with an Undo action after deleting workflow elements.
   *
   * @param message Message shown in the toast.
   */
  function showDeleteUndoToast(message: string) {
    toast.custom(
      (t) => (
        <div
          className={styles.undoToast}
          role="status"
          aria-live="polite"
        >
          <span className={styles.undoToastText}>{message}</span>

          <button
            type="button"
            className={styles.undoToastBtn}
            onClick={() => {
              dispatch({ type: 'history/undo' });
              toast.dismiss(t.id);
            }}
          >
            Undo
          </button>
        </div>
      ),
      {
        duration: 4000,
      }
    );
  }

  /**
   * @brief Delete currently selected nodes or edge.
   */
  function onDeleteSelected() {
    const start = performance.now();

    if (state.selectedEdgeId) {
      dispatch({ type: 'edge/remove', edgeId: state.selectedEdgeId });
      showDeleteUndoToast('Edge deleted');
      return;
    }

    if (state.selectedNodeIds.length > 0) {
      const count = state.selectedNodeIds.length;

      dispatch({ type: 'node/removeMany', nodeIds: state.selectedNodeIds });
      showDeleteUndoToast(count === 1 ? 'Node deleted' : `${count} nodes deleted`);
    }

    requestAnimationFrame(() => {
      const end = performance.now();
      console.log(`Delete latency: ${(end - start).toFixed(2)} ms`);
    });
  }

  /**
   * @brief Send workflow to backend and trigger execution or script generation.
   */
  async function onRun() {
    if (isRunning) return;

    setIsRunning(true);
    setRunError(null);
    setSubmitPrompt(null);

    const toastId = toast.loading('Running workflow...');

    try {
      const res = await fetch('http://127.0.0.1:8000/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.workflow),
      });

      const data = await res.json();

      console.log('RUN result:', data);

      if (!res.ok) {
        toast.error('RUN failed', { id: toastId });

        setRunError({
          title: 'Backend error',
          message: data.detail ?? 'Unknown backend error.',
        });

        return;
      }

      if (data.ok) {
        const backend = state.workflow.run?.backend ?? 'local';

        if (backend === 'local') {
          toast.success('Workflow finished successfully', { id: toastId });
        } else {
          toast.success(`${backend.toUpperCase()} scripts generated successfully`, {
            id: toastId,
          });

          if (data.run_dir) {
            setSubmitPrompt({
              runDir: data.run_dir,
              backend,
            });
          }
        }
      } else {
        toast.error('Workflow failed', { id: toastId });

        setRunError({
          title: 'Workflow execution failed',
          message: data.message || 'Workflow execution failed.',
          stderr: data.stderr || '',
          returncode: data.returncode ?? null,
          runDir: data.run_dir ?? null,
        });
      }
    } catch (err) {
      console.error(err);

      toast.error('Could not connect to backend', { id: toastId });

      setRunError({
        title: 'Connection error',
        message: 'Could not connect to backend.',
      });
    } finally {
      setIsRunning(false);
    }
  }

  function measureUndo() {
    const start = performance.now();

    dispatch({ type: 'history/undo' });

    requestAnimationFrame(() => {
      const end = performance.now();
      console.log(`Undo latency: ${(end - start).toFixed(2)} ms`);
    });
  }


  /**
   * @brief Upload generated Slurm or PBS scripts to a remote server via SSH without executing them.
   * 
   */
  async function onUploadBatch() {
    if (!submitPrompt || isSubmitting) return;

    if (!remoteHost.trim() || !remoteUser.trim() || !remotePath.trim()) {
      toast.error('Please fill hostname, username and remote path.');
      return;
    }

    setIsSubmitting(true);
    setRunError(null);

    const toastId = toast.loading('Uploading workflow scripts to remote server...');

    try {
      const res = await fetch('http://127.0.0.1:8000/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_dir: submitPrompt.runDir,
          username: remoteUser,
          hostname: remoteHost,
          remote_path: remotePath,
          key_path: remoteKeyPath.trim() || null,
          key_passphrase: remoteKeyPassphrase || null,
        }),
      });

      const data = await res.json();


      if (!res.ok) {
        toast.error('Remote upload failed', { id: toastId });

        setRunError({
          title: 'Remote upload failed',
          message: data.detail ?? 'Unknown remote upload error.',
          stderr: data.stderr || '',
          returncode: data.returncode ?? null,
          runDir: submitPrompt.runDir,
        });
        return;
      }

      if (data.ok) {
        toast.success('Workflow scripts uploaded successfully', { id: toastId });

        setSubmitPrompt(null);
        setRemoteKeyPassphrase('');
      } else {
        toast.error('Workflow upload failed', { id: toastId });

        setRunError({
          title: 'Workflow upload failed',
          message: data.message || 'Workflow upload failed.',
          stderr: data.stderr || '',
          returncode: data.returncode ?? null,
          runDir: submitPrompt.runDir,
        });
      }
    } catch (err) {
      console.error(err);

      toast.error('Could not connect to backend', { id: toastId });

      setRunError({
        title: 'Connection error',
        message: 'Could not connect to backend.',
        runDir: submitPrompt.runDir,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * @brief Download generated Slurm or PBS scripts as a zip file.
   * 
   */
  async function onDownloadScripts() {
    if (!submitPrompt) return;

    try {
      await downloadScriptsZip(submitPrompt.runDir);
      toast.success('Scripts downloaded');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to download scripts');
    }
  }

  useTopBarShortcuts({
    isDirty,
    dispatch,
    selectedNodeIds: state.selectedNodeIds,
    selectedEdgeId: state.selectedEdgeId,
    setIsNewModalOpen,
    startNewWorkflow,
    showDeleteUndoToast,
  });

  return (
    <>
      <div className={styles.root}>
        <button type="button" className={styles.btn} onClick={onNewClick} title="New workflow (Ctrl+N)">
          NEW
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={styles.btn}
              title="Save workflow"
            >
              SAVE AS
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={styles.dropdownContent}
              sideOffset={8}
              align="start"
            >
              <DropdownMenu.Item
                className={styles.dropdownItem}
                onSelect={onSaveAsJson}
              >
                Save as JSON
              </DropdownMenu.Item>

              <DropdownMenu.Item
                className={styles.dropdownItem}
                onSelect={() => {
                  void onSaveAsCwl();
                }}
              >
                Save as CWL (.zip)
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button type="button" className={styles.btn} onClick={onImportClick} title="Import workflow from JSON">
          IMPORT
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={onImportFile}
          className={styles.hiddenFile}
        />

        <div className={styles.divider} />

        <button
          type="button"
          className={`${styles.iconBtnArrow} ${!canUndo ? styles.disabled : ''}`}
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={measureUndo}
        >
          <ArrowUturnLeftIcon className={styles.icon} />
        </button>

        <button
          type="button"
          className={`${styles.iconBtnArrow} ${!canRedo ? styles.disabled : ''}`}
          title="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={() => dispatch({ type: 'history/redo' })}
        >
          <ArrowUturnRightIcon className={styles.icon} />
        </button>

        <div className={styles.divider} />

        <button
          type="button"
          className={`${styles.groupBtn} ${!(canGroupSelection || canUngroupSelection) ? styles.disabled : ''}`}
          disabled={!(canGroupSelection || canUngroupSelection)}
          onClick={() => {
            if (canUngroupSelection) {
              dispatch({ type: 'workflow/ungroupSelectedSubworkflow' });
              return;
            }

            if (canGroupSelection) {
              dispatch({ type: 'workflow/groupSelection' });
            }
          }}
          title={
            canUngroupSelection
              ? 'Ungroup selected subworkflow'
              : 'Create subworkflow from selected nodes'
          }
        >
          {canUngroupSelection ? 'UNGROUP' : 'GROUP'}
        </button>

        <div className={styles.divider} />

        <button
          type="button"
          className={`${styles.iconBtn} ${!hasSelection ? styles.disabled : ''}`}
          disabled={!hasSelection}
          onClick={onDeleteSelected}
          title="Delete selected node"
        >
          <TrashIcon className={styles.icon} />
        </button>

        <div className={styles.divider} />

        <button
          type="button"
          className={styles.runBtn}
          onClick={onRun}
          disabled={isRunning || isSubmitting}
        >
          {isRunning ? 'RUNNING...' : 'RUN'}
        </button>
      </div>

  <TopBarModals
    runError={runError}
    setRunError={setRunError}
    submitPrompt={submitPrompt}
    setSubmitPrompt={setSubmitPrompt}
    isSubmitting={isSubmitting}
    onUploadBatch={onUploadBatch}
    onDownloadScripts={onDownloadScripts}
    remoteHost={remoteHost}
    setRemoteHost={setRemoteHost}
    remoteUser={remoteUser}
    setRemoteUser={setRemoteUser}
    remotePath={remotePath}
    setRemotePath={setRemotePath}
    remoteKeyPath={remoteKeyPath}
    setRemoteKeyPath={setRemoteKeyPath}
    remoteKeyPassphrase={remoteKeyPassphrase}
    setRemoteKeyPassphrase={setRemoteKeyPassphrase}
    isNewModalOpen={isNewModalOpen}
    setIsNewModalOpen={setIsNewModalOpen}
    onImportJson={() => {
      setIsNewModalOpen(false);
      fileRef.current?.click();
    }}
    onStartEmpty={startNewWorkflow}
  />
    </>
  );
}