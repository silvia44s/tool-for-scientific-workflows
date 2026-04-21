/**
 * @file useTopBarShortcuts.ts
 * @brief Registers keyboard shortcuts and unload protection used by the workflow editor top bar.
 * @author Silvia Šlachtovská
 */

import { useEffect } from 'react';
import type { Action } from '../../../../domain/workflow/model/actions';

type Params = {
  isDirty: boolean;
  dispatch: React.Dispatch<Action>;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  setIsNewModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  startNewWorkflow: () => void;
  showDeleteUndoToast: (message: string) => void;
};

/**
 * @brief Registers browser unload protection and top bar keyboard shortcuts.
 *
 * Handles:
 * - warning before leaving the page with unsaved changes,
 * - creating a new workflow using Ctrl+N,
 * - undo and redo shortcuts,
 * - deleting selected nodes or edges using Delete or Backspace.
 *
 * @param params Set of callbacks and state required by the shortcut handlers.
 */
export function useTopBarShortcuts({
  isDirty,
  dispatch,
  selectedNodeIds,
  selectedEdgeId,
  setIsNewModalOpen,
  startNewWorkflow,
  showDeleteUndoToast,
}: Params) {
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

      if (selectedEdgeId) {
        dispatch({ type: 'edge/remove', edgeId: selectedEdgeId });
        showDeleteUndoToast('Edge deleted');
        return;
      }

      if (selectedNodeIds.length > 0) {
        const count = selectedNodeIds.length;

        dispatch({ type: 'node/removeMany', nodeIds: selectedNodeIds });
        showDeleteUndoToast(count === 1 ? 'Node deleted' : `${count} nodes deleted`);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    dispatch,
    isDirty,
    selectedEdgeId,
    selectedNodeIds,
    setIsNewModalOpen,
    showDeleteUndoToast,
    startNewWorkflow,
  ]);
}