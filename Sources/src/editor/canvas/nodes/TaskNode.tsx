/**
 * @file TaskNode.tsx
 * @brief ReactFlow node component representing a workflow task.
 * @author Silvia Šlachtovská 
 *
 * This component renders a visual node inside the workflow canvas.
 * Each node represents one executable task and shows:
 *
 * - task name
 * - binary path (subtitle)
 * - input ports
 * - output ports
 *
 * Ports are rendered as ReactFlow handles and allow users to create
 * connections between tasks.
 */

import { Handle, Position, type NodeProps } from 'reactflow';
import styles from './TaskNode.module.css';
import type { TaskIO, IOPort, PortDataType } from '../../state/model';

/**
 * Data structure stored inside ReactFlow node `data`.
 */
type TaskNodeData = {
  title: string;
  subtitle?: string;
  ports: TaskIO;
};


/**
 * Returns a color associated with a specific port data type.
 * Used to visually distinguish different types of connections.
 */
function portColor(t: PortDataType): string {
  switch (t) {
    case 'file': return '#267e5b';       // green-ish
    case 'directory': return '#0a8a5b';
    case 'string': return '#315680';     // blue-ish
    case 'number': return '#531949';     // purple-ish
    case 'boolean': return '#681818';    // red-ish
    default: return '#A3A3A3';
  }
}


/**
 * Small component representing a single port row in the node UI.
 *
 * Each row shows:
 * - port name
 * - port type
 * - connection handle (left or right side)
 *
 * Input ports appear on the left side,
 * output ports appear on the right side.
 */
function PortRow({
  port,
  side,
}: {
  port: IOPort;
  side: 'left' | 'right';
}) {
  const isInput = side === 'left';
  const color = portColor(port.dataType);

  return (
    <div className={styles.portRow}>
      {/* input handle on the left */}
      {isInput && (
        <Handle
          id={port.id}
          type="target"
          position={Position.Left}
          className={styles.handle}
          style={{ background: color, borderColor: color }}
          title={`${port.name} (${port.dataType})`}
        />
      )}

      <div className={styles.portLabel}>
        <span className={styles.portName}>{port.name}</span>
        <span className={styles.portType}>{port.dataType}</span>
      </div>

      {/* output handle on the right */}
      {!isInput && (
        <Handle
          id={port.id}
          type="source"
          position={Position.Right}
          className={styles.handle}
          style={{ background: color, borderColor: color }}
          title={`${port.name} (${port.dataType})`}
        />
      )}
    </div>
  );
}


/**
 * Main visual representation of a task node inside the canvas.
 *
 * ReactFlow passes node data and selection state through NodeProps.
 * The component renders:
 *
 * - header with task name
 * - binary path (subtitle)
 * - list of input and output ports
 *
 * Selected nodes receive a different CSS style for highlighting.
 */
export function TaskNodeView({ data, selected }: NodeProps<TaskNodeData>) {
  const inputs = data.ports?.inputs ?? [];
  const outputs = data.ports?.outputs ?? [];

  return (
    <div className={`${styles.root} ${selected ? styles.selected : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>{data.title}</div>
      </div>

      <div className={styles.binaryRow}>
        <span className={styles.binaryLabel}>binary:</span>
        <span className={styles.binaryValue}>{data.subtitle || '—'}</span>
      </div>

      <div className={styles.ports}>
        {inputs.map((p) => (
          <PortRow key={p.name} port={p} side="left" />
        ))}
        {outputs.map((p) => (
          <PortRow key={p.name} port={p} side="right" />
        ))}
      </div>
    </div>
  );
}