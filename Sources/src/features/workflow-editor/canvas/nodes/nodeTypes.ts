/**
 * @file nodeTypes.ts
 * @brief Type definitions for ReactFlow node data used in the workflow canvas.
 *
 * This file defines the shape of data passed to node components
 * when rendering workflow nodes inside ReactFlow.
 */

import type { TaskIO } from '../../../../domain/workflow/model/model';

/**
 * @brief Data structure stored in ReactFlow nodes.
 *
 * Contains all information required to render a node in the canvas,
 * including its title, optional subtitle, and input/output ports.
 */
export type WorkflowCanvasNodeData = {
  title: string;
  subtitle?: string;
  ports: TaskIO;
};