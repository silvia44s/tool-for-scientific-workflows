/**
 * @file SubworkflowNode.tsx
 * @brief Renders a subworkflow node inside the editor canvas.
 *
 * This component provides the visual representation of a subworkflow node in ReactFlow.
 * It is responsible for displaying the subworkflow title, description subtitle,
 * and all input and output ports using the shared node layout and port row component.
 */

import type { NodeProps } from 'reactflow';
import styles from './SubworkflowNode.module.css';
import baseStyles from '../NodeBase.module.css';
import { PortRow } from '../PortRow';
import type { WorkflowCanvasNodeData } from '../nodeTypes';

/**
 * @brief Displays a subworkflow node with its ports and description.
 *
 * The component renders a styled node card using shared base node styles
 * combined with subworkflow-specific visual theme classes. Input and output ports
 * are displayed as separate rows with ReactFlow handles.
 *
 * @param data Node data used for rendering the title, subtitle, and ports.
 * @param selected Indicates whether the node is currently selected in the canvas.
 * @return JSX element representing a subworkflow node in the workflow canvas.
 */
export function SubworkflowNodeView({
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
        <span className={baseStyles.subtitleLabel}>dsc:</span>
        <span className={baseStyles.subtitleValue}>
          {data.subtitle || 'subworkflow'}
        </span>
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