/**
 * @file EditorPage.tsx
 * @brief Main page of the workflow editor.
 * @author Silvia Šlachtovská
 *
 * This component builds the whole editor screen. It wraps the app
 * in the workflow state provider, shows toast notifications, and
 * connects the main layout parts such as the canvas, top bar,
 * side panels, and panel toggle button.
 */

import { useState } from 'react';
import styles from './EditorPage.module.css';

import { EditorLayout } from './layout/EditorLayout';
import { LeftPanel } from './layout/LeftPanel';
import { RightPanel } from './layout/RightPanel';
import { WorkflowCanvas } from './canvas/WorkflowCanvas';
import { WorkflowProvider } from './state/workflowState';
import { TopBar } from './layout/TopBar';

import { Toaster } from 'react-hot-toast';

/**
 * @brief Main editor page component.
 *
 * This component is the root of the workflow editor UI.
 * It handles the left floating panel and
 * renders the main editor layout.
 *
 * Layout parts:
 * - workflow canvas in the center
 * - top toolbar
 * - collapsible left panel
 * - right settings/details panel
 * - toast notifications
 *
 * @returns Rendered editor page.
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
          <div className={styles.centerWrap}>
            <WorkflowCanvas />
            <TopBar />

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
                  ✕
                </button>
              </div>

              <LeftPanel />
            </div>

            {/* Button shown only when the left panel is hidden. */}
            {!leftOpen && (
              <button
                type="button"
                className={styles.showLeftBtn}
                onClick={() => setLeftOpen(true)}
                title="Show panel"
              >
                ☰
              </button>
            )}
          </div>
        }
        right={<RightPanel />}
      />
    </WorkflowProvider>
  );
}