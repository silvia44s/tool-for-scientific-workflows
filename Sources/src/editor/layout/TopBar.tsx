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

import { useRef, useState, useEffect } from 'react';
import styles from './TopBar.module.css';
import { useWorkflowState } from '../state/workflowState';
import { getActiveWorkflow, createInitialWorkflow } from '../state/workflowUtils';
import toast from 'react-hot-toast';

import { exportWorkflowAsCwl } from '../../export/cwl';
import { downloadCwlBundleZip } from '../../export/cwl/downloadBundle';

import {
  TrashIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
} from '@heroicons/react/24/outline';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';


/**
 * Information about a workflow execution error returned by the backend.
 */
type RunErrorInfo = {
  title: string;
  message: string;
  stderr?: string;
  returncode?: number | null;
  runDir?: string | null;
};


/**
 * Information about generated batch scripts waiting for optional submit.
 */
type SubmitPromptInfo = {
  runDir: string;
  backend: 'slurm' | 'pbs';
};


/**
 * Main toolbar component displayed above the workflow canvas.
 */
export function TopBar() {
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runError, setRunError] = useState<RunErrorInfo | null>(null);
  const [submitPrompt, setSubmitPrompt] = useState<SubmitPromptInfo | null>(null);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const { state, dispatch, canUndo, canRedo, isDirty, markSaved } = useWorkflowState();
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

  /**
   * Helper function to download JSON data as a file.
   */
  function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }


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
   * Export current workflow as JSON or CWL file.
   */
  function onSaveAsJson() {
    downloadJson(`${state.workflow.name || 'workflow'}.json`, state.workflow);
    markSaved();
    toast.success('Workflow saved as JSON');
  }

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
   * Open hidden file input for workflow import.
   */
  function onImportClick() {
    fileRef.current?.click();
  }


  /**
   * Handle workflow import from JSON file.
   */
  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      const text = await f.text();
      const wf = JSON.parse(text);

      dispatch({ type: 'workflow/replace', workflow: wf });
      markSaved();
      setSubmitPrompt(null);
      setIsNewModalOpen(false);
      toast.success('Workflow imported');

    } catch {
      alert('Invalid JSON file');
    } finally {
      e.target.value = '';
    }
  }


  /**
   * Delete currently selected nodes or edge.
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
   * Send workflow to backend and trigger execution or script generation.
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
          toast.success(`${backend.toUpperCase()} scripts generated successfully`, { id: toastId });

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
   * Submit previously generated Slurm/PBS scripts.
   */
  async function onSubmitBatch() {
    if (!submitPrompt || isSubmitting) return;

    setIsSubmitting(true);
    setRunError(null);

    const toastId = toast.loading('Submitting workflow...');

    try {
      const res = await fetch('http://127.0.0.1:8000/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_dir: submitPrompt.runDir }),
      });

      const data = await res.json();

      console.log('SUBMIT result:', data);

      if (!res.ok) {
        toast.error('Submit failed', { id: toastId });

        setRunError({
          title: 'Submit failed',
          message: data.detail ?? 'Unknown submit error.',
          stderr: data.stderr || '',
          returncode: data.returncode ?? null,
          runDir: submitPrompt.runDir,
        });

        return;
      }

      if (data.ok) {
        toast.success('Workflow submitted successfully', { id: toastId });
        setSubmitPrompt(null);
      } else {
        toast.error('Workflow submission failed', { id: toastId });

        setRunError({
          title: 'Workflow submission failed',
          message: data.message || 'Workflow submission failed.',
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

useEffect(() => {
  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (!isDirty) return;

    e.preventDefault();
    e.returnValue = '';
  }

  window.addEventListener('beforeunload', onBeforeUnload);
  return () => window.removeEventListener('beforeunload', onBeforeUnload);
}, [isDirty]);

useEffect(() => {
  function isTypingInEditable(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;

    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return true;
    }

    if (target.isContentEditable) {
      return true;
    }

    return false;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isTypingInEditable(e.target)) return;

    const isMod = e.ctrlKey || e.metaKey;

    if (isMod && e.key.toLowerCase() === 'n') {
      e.preventDefault();

      if (isDirty) {
        setIsNewModalOpen(true);
      } else {
        startNewWorkflow();
      }
      return;
    }

    if (isMod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      dispatch({ type: 'history/undo' });
      return;
    }

    if (
      (isMod && e.shiftKey && e.key.toLowerCase() === 'z') ||
      (e.ctrlKey && e.key.toLowerCase() === 'y')
    ) {
      e.preventDefault();
      dispatch({ type: 'history/redo' });
      return;
    }

    if (e.key !== 'Delete' && e.key !== 'Backspace') return;

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
    }

  window.addEventListener('keydown', onKeyDown);

  return () => window.removeEventListener('keydown', onKeyDown);
}, [state.selectedNodeIds, state.selectedEdgeId, dispatch, isDirty]);

  return (
    <>
      <div className={styles.root}>
        <button type="button" className={styles.btn} onClick={onNewClick} title="New workflow (Ctrl+N)">
          NEW
        </button>

        {/* export workflow */}
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


        {/* import workflow */}
        <button type="button" className={styles.btn} onClick={onImportClick} title="Import workflow from JSON">
          IMPORT
        </button>


        {/* hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={onImportFile}
          className={styles.hiddenFile}
        />

        <div className={styles.divider} />
        {/* undo / redo */}
        <button
          type="button"
          className={`${styles.iconBtnArrow} ${!canUndo ? styles.disabled : ''}`}
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          //onClick={() => dispatch({ type: 'history/undo' })}
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

        {/* delete selected element */}
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


      {/* error modal shown when workflow execution fails */}
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


      {/* modal shown after batch scripts are generated */}
      {submitPrompt && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (!isSubmitting) setSubmitPrompt(null);
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
                  if (!isSubmitting) setSubmitPrompt(null);
                }}
                disabled={isSubmitting}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalMessage}>
                Workflow scripts were generated successfully. Do you want to submit them now?
              </p>

              <div className={styles.modalMeta}>
                <strong>Run dir:</strong> {submitPrompt.runDir}
              </div>
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
                onClick={onSubmitBatch}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'SUBMITTING...' : 'Submit now'}
              </button>
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
                onClick={() => {
                  setIsNewModalOpen(false);
                  fileRef.current?.click();
                }}
              >
                Import JSON
              </button>

              <button
                type="button"
                className={styles.modalOkBtn}
                onClick={startNewWorkflow}
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
