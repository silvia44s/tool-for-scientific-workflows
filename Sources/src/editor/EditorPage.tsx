import { LeftPanel } from './layout/LeftPanel';
import { RightPanel } from './layout/RightPanel';
import { TopBar } from './layout/TopBar';
import { WorkflowCanvas } from './canvas/WorkflowCanvas';

export function EditorPage() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: 280, borderRight: '1px solid #e5e7eb' }}>
          <LeftPanel />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <WorkflowCanvas />
        </div>

        <div style={{ width: 320, borderLeft: '1px solid #e5e7eb' }}>
          <RightPanel />
        </div>
      </div>
    </div>
  );
}
