/**
 * @file nodeUtils.ts
 * @brief Utility functions used for rendering workflow nodes.
 *
 * This file provides helper functions related to node visualization,
 * such as mapping port data types to colors for consistent UI representation.
 */

import type { PortDataType } from '../../../../domain/workflow/model/model';

/**
 * @brief Returns a color associated with a specific port data type.
 *
 * This function is used to visually distinguish different kinds of data
 * flowing through ports in the workflow canvas.
 *
 * @param type Port data type.
 * @return Hex color string representing the given data type.
 */
export function getPortColor(type: PortDataType): string {
  switch (type) {
    case 'file':
      return '#07db86';
    case 'directory':
      return '#83f90c';
    case 'string':
      return '#0070f0';
    case 'number':
      return '#e105bd';
    case 'boolean':
      return '#ab08fc';
    default:
      return '#A3A3A3';
  }
}