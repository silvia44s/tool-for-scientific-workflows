import { Handle, Position, type NodeProps } from 'reactflow';
import styles from './SubworkflowNode.module.css';
import type { TaskIO, IOPort, PortDataType } from '../../state/model';

type SubworkflowNodeData = {
  title: string;
  subtitle?: string;
  ports: TaskIO;
};

function portColor(t: PortDataType): string {
  switch (t) {
    case 'file': return '#267e5b';
    case 'directory': return '#0a8a5b';
    case 'string': return '#315680';
    case 'number': return '#531949';
    case 'boolean': return '#681818';
    default: return '#A3A3A3';
  }
}

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

export function SubworkflowNodeView({ data, selected }: NodeProps<SubworkflowNodeData>) {
  const inputs = data.ports?.inputs ?? [];
  const outputs = data.ports?.outputs ?? [];

  return (
    <div className={`${styles.root} ${selected ? styles.selected : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>{data.title}</div>
      </div>

      <div className={styles.binaryRow}>
        <span className={styles.binaryLabel}>dsc:</span>
        <span className={styles.binaryValue}>{data.subtitle || 'subworkflow'}</span>
      </div>

      <div className={styles.ports}>
        {inputs.map((p) => (
          <PortRow key={p.id} port={p} side="left" />
        ))}
        {outputs.map((p) => (
          <PortRow key={p.id} port={p} side="right" />
        ))}
      </div>
    </div>
  );
}