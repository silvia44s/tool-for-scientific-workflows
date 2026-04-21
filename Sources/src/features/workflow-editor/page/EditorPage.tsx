/**
 * @file EditorPage.tsx
 * @brief Composes the main workflow editor page, including provider setup, layout, and editor panels.
 * @author Silvia Šlachtovská
 *
 * This file defines the top-level page of the workflow editor.
 * It connects the workflow state provider with the main layout and
 * assembles the central canvas area, left panel, right panel, top bar,
 * overlay components, and toast notifications.
 */

import { useState } from 'react';
import styles from './EditorPage.module.css';

import { EditorLayout } from '../layout/EditorLayout';
import { LeftPanel } from '../layout/left-panel/LeftPanel';
import { RightPanel } from '../layout/right-panel';
import { WorkflowCanvas } from '../canvas/WorkflowCanvas';
import { WorkflowProvider } from '../provider/WorkflowProvider';
import { useWorkflow } from '../provider/useWorkflow';
import { TopBar } from '../layout/topbar/TopBar';
import { SubworkflowOverlay } from '../canvas/SubworkflowOverlay';

import { Toaster } from 'react-hot-toast';

import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline';

type EditorCenterProps = {
  /** Indicates whether the left floating panel is currently visible. */
  leftOpen: boolean;

  /** Updates the visibility state of the left floating panel. */
  setLeftOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

/**
 * @brief Renders the central editor workspace.
 *
 * This component contains the workflow canvas, top bar, optional subworkflow overlay,
 * and the collapsible floating left panel used for inserting nodes and presets.
 *
 * @param leftOpen Whether the left floating panel is open.
 * @param setLeftOpen Setter used to show or hide the left floating panel.
 * @return JSX element representing the center area of the workflow editor.
 */
function EditorCenter({
  leftOpen,
  setLeftOpen,
}: EditorCenterProps) {
  const { state } = useWorkflow();

  return (
    <div className={styles.centerWrap}>
      <WorkflowCanvas />
      <TopBar />

      {state.activePath.length > 0 && <SubworkflowOverlay />}

      <div
        className={`${styles.floatingLeft} ${leftOpen ? styles.open : styles.closed}`}
      >
        <div className={styles.floatingHeader}>
          <button
            type="button"
            className={styles.hideBtn}
            onClick={() => setLeftOpen(false)}
            title="Hide panel"
          >
            <ChevronDoubleLeftIcon className={styles.hideIcon} />
          </button>
        </div>

        <LeftPanel />
      </div>

      {!leftOpen && (
        <button
          type="button"
          className={styles.showLeftBtn}
          onClick={() => setLeftOpen(true)}
          title="Show panel"
        >
          <ChevronDoubleRightIcon className={styles.showLeftIcon} />
        </button>
      )}
    </div>
  );
}

/**
 * @brief Renders the complete workflow editor page.
 *
 * This component initializes the workflow provider, toast notification system,
 * and the main editor layout. It is the entry point of the workflow editor UI.
 *
 * @return JSX element representing the complete editor page.
 */
export function EditorPage() {
  const [leftOpen, setLeftOpen] = useState(true);

  return (
    <WorkflowProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgb(17, 20, 75, 0.8)',
            color: 'rgb(241, 219, 255, 0.8)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '15px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: '500',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          },
          success: {
            iconTheme: {
              primary: '#4ade80',
              secondary: '#11144B',
            },
          },
          error: {
            style: {
              background: 'rgb(210, 106, 113)',
              color: '#93000A',
            },
            iconTheme: {
              primary: '#93000A',
              secondary: 'rgb(210, 106, 113)',
            },
          },
        }}
      />

      <EditorLayout
        center={
          <EditorCenter
            leftOpen={leftOpen}
            setLeftOpen={setLeftOpen}
          />
        }
        right={<RightPanel />}
      />
    </WorkflowProvider>
  );
}