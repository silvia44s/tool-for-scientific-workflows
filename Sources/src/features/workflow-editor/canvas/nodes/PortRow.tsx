/**
 * @file PortRow.tsx
 * @brief Renders a single input or output port row inside a workflow node.
 *
 * This component is shared between different node types and is responsible for:
 * - displaying the port name and its data type,
 * - rendering a ReactFlow handle on the correct side,
 * - visually distinguishing port types using color coding.
 */

import { Handle, Position } from 'reactflow';
import type { IOPort } from '../../../../domain/workflow/model/model';
import { getPortColor } from './nodeUtils';

/**
 * @brief Props for the PortRow component.
 *
 * Defines the port data, its position (input/output side),
 * and a set of CSS class names used for styling.
 */
type PortRowProps = {
  port: IOPort;
  side: 'left' | 'right';
  classNames: {
    portRow: string;
    handle: string;
    portLabel: string;
    portName: string;
    portType: string;
  };
};

/**
 * @brief Displays a single port entry within a node.
 *
 * Renders the port label and a corresponding ReactFlow handle.
 * The handle is placed on the left for input ports and on the right for output ports.
 * The handle color reflects the port data type.
 *
 * @param port Port definition including id, name, and data type.
 * @param side Determines whether the port is rendered as input ("left") or output ("right").
 * @param classNames CSS class names used for styling the row and its elements.
 * @return JSX element representing a single port row.
 */
export function PortRow({ port, side, classNames }: PortRowProps) {
  const isInput = side === 'left';
  const color = getPortColor(port.dataType);

  return (
    <div className={classNames.portRow}>
      {isInput && (
        <Handle
          id={port.id}
          type="target"
          position={Position.Left}
          className={classNames.handle}
          style={{ background: color, borderColor: color }}
          title={`${port.name} (${port.dataType})`}
        />
      )}

      <div className={classNames.portLabel}>
        <span className={classNames.portName}>{port.name}</span>
        <span className={classNames.portType}>{port.dataType}</span>
      </div>

      {!isInput && (
        <Handle
          id={port.id}
          type="source"
          position={Position.Right}
          className={classNames.handle}
          style={{ background: color, borderColor: color }}
          title={`${port.name} (${port.dataType})`}
        />
      )}
    </div>
  );
}