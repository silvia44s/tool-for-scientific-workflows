/**
 * @file TaskNode.tsx
 * @brief Renders a workflow task node inside the editor canvas.
 *
 * This component provides the visual representation of a task node in ReactFlow.
 * It is responsible for displaying the task title, binary path subtitle,
 * and all input and output ports using the shared node layout and port row component.
 */

import type { NodeProps } from 'reactflow';
import baseStyles from '../NodeBase.module.css';
import styles from './TaskNode.module.css';
import { PortRow } from '../PortRow';
import type { WorkflowCanvasNodeData } from '../nodeTypes';

/**
 * @brief Displays a task node with its ports and execution binary.
 *
 * The component renders a styled node card using shared base node styles
 * combined with task-specific visual theme classes. Input and output ports
 * are displayed as separate rows with ReactFlow handles.
 *
 * @param data Node data used for rendering the title, subtitle, and ports.
 * @param selected Indicates whether the node is currently selected in the canvas.
 * @return JSX element representing a task node in the workflow canvas.
 */
export function TaskNodeView({
  data,
  selected,
}: NodeProps<WorkflowCanvasNodeData>) {
  const inputs = data.ports?.inputs ?? [];
  const outputs = data.ports?.outputs ?? [];

  const portRowClassNames = {
    portRow: `${baseStyles.portRow} ${styles.portRow}`,
    handle: baseStyles.handle,
    portLabel: baseStyles.portLabel,
    portName: baseStyles.portName,
    portType: baseStyles.portType,
  };

  return (
    <div
      className={`${baseStyles.root} ${styles.root} ${selected ? baseStyles.selected : ''}`}
    >
      <div className={`${baseStyles.header} ${styles.header}`}>
        <div className={baseStyles.headerTitle}>{data.title}</div>
      </div>

      <div className={`${baseStyles.subtitleRow} ${styles.subtitleRow}`}>
        <span className={baseStyles.subtitleLabel}>binary:</span>
        <span className={baseStyles.subtitleValue}>{data.subtitle || '—'}</span>
      </div>

      <div className={baseStyles.ports}>
        {inputs.map((port) => (
          <PortRow
            key={port.id}
            port={port}
            side="left"
            classNames={portRowClassNames}
          />
        ))}
        {outputs.map((port) => (
          <PortRow
            key={port.id}
            port={port}
            side="right"
            classNames={portRowClassNames}
          />
        ))}
      </div>
    </div>
  );
}