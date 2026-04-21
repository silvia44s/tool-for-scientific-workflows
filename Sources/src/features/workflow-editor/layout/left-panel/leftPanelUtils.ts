/**
 * @file leftPanelUtils.ts
 * @brief Utility functions used by the workflow editor left panel.
 * @author Silvia Šlachtovská
 */

import type { TaskNodePreset, WorkflowNode } from '../../../../domain/workflow/model/model';
import { createTaskNodeFromPreset } from '../../../../domain/workflow/operations/taskPresets';

/**
 * @brief Creates multiple task nodes from a preset and arranges them in a grid.
 *
 * @param preset Preset used to create the nodes.
 * @param count Number of nodes to create.
 * @return Array of created workflow nodes.
 */
export function createPresetNodesInGrid(
  preset: TaskNodePreset,
  count: number
): WorkflowNode[] {
  const startX = 140;
  const startY = 140;
  const colWidth = 220;
  const rowHeight = 140;
  const cols = 3;

  return Array.from({ length: count }, (_, i) => {
    const position = {
      x: startX + (i % cols) * colWidth,
      y: startY + Math.floor(i / cols) * rowHeight,
    };

    return createTaskNodeFromPreset(preset, position);
  });
}