/**
 * @file SubworkflowPropertiesSection.tsx
 * @brief Section in the right panel showing properties of a subworkflow node.
 * @author Silvia Šlachtovská
 * 
 */

import styles from '../../RightPanel.module.css';
import type { WorkflowNode } from '../../../state/model';
import { SectionTitle } from '../rightPanelFormParts';

type SubworkflowNodeOnly = Extract<WorkflowNode, { type: 'subworkflow' }>;

export function SubworkflowPropertiesSection({
  node,
}: {
  node: SubworkflowNodeOnly;
}) {
  return (
    <div className={styles.taskNode}>
      <section className={styles.section}>
        <SectionTitle>Subworkflow</SectionTitle>

        <div className={styles.hintText}>
          nodes: {Object.keys(node.subworkflow.workflow.nodes).length}
        </div>

        {Object.values(node.subworkflow.workflow.nodes).length > 0 ? (
          <div className={styles.nodesList}>
            {Object.values(node.subworkflow.workflow.nodes).map((innerNode) => (
              <div key={innerNode.id} className={styles.nodeChip}>
                <span className={styles.nodeChipName}>{innerNode.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.hintText}>No inner nodes.</div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <SectionTitle>Inputs</SectionTitle>
        </div>

        {node.subworkflow.io.inputs.length > 0 ? (
          <div style={{ width: '90%' }} className={styles.paramList}>
            {node.subworkflow.io.inputs.map((p) => (
              <div key={p.id} className={styles.paramChip}>
                <span className={styles.paramChipName}>{p.name}</span>
                <span className={styles.paramChipSep}>:</span>
                <span className={styles.paramChipValue}>{p.dataType}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.hintText}>No input ports.</div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <SectionTitle>Outputs</SectionTitle>
        </div>

        {node.subworkflow.io.outputs.length > 0 ? (
          <div style={{ width: '90%' }} className={styles.paramList}>
            {node.subworkflow.io.outputs.map((p) => (
              <div key={p.id} className={styles.paramChip}>
                <span className={styles.paramChipName}>{p.name}</span>
                <span className={styles.paramChipSep}>:</span>
                <span className={styles.paramChipValue}>{p.dataType}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.hintText}>No output ports.</div>
        )}
      </section>
    </div>
  );
}