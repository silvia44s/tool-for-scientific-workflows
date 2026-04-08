import { useState } from 'react';
import styles from './EditorPage.module.css';

import { EditorLayout } from './layout/EditorLayout';
import { LeftPanel } from './layout/LeftPanel';
import { RightPanel } from './layout/RighPanel';
import { WorkflowCanvas } from './canvas/WorkflowCanvas';
import { WorkflowProvider, useWorkflowState } from './state/workflowState';
import { TopBar } from './layout/TopBar';
import { SubworkflowOverlay } from './canvas/SubworkflowOverlay';

import { Toaster } from 'react-hot-toast';

import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline';

function EditorCenter({
  leftOpen,
  setLeftOpen,
}: {
  leftOpen: boolean;
  setLeftOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { state } = useWorkflowState();

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