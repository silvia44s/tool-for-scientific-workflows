/**
 * @file diagnostics.ts
 * @brief Provides helper functions for creating and evaluating export diagnostics.
 *
 * This file defines small utility helpers used by the CWL export pipeline
 * to report errors and warnings and to check whether export can continue.
 */

import type { ExportDiagnostic } from './types';

/**
 * @brief Checks whether a diagnostic collection contains at least one error.
 *
 * @param diagnostics Diagnostics produced during export normalization or rendering.
 * @return True if at least one diagnostic has level "error".
 */
export function hasErrors(diagnostics: ExportDiagnostic[]): boolean {
  return diagnostics.some(d => d.level === 'error');
}

/**
 * @brief Creates an export diagnostic with level "error".
 *
 * Optional context may reference a related node, port or parameter.
 *
 * @param message Human-readable error message.
 * @param ctx Optional diagnostic context.
 * @return Export diagnostic object with error severity.
 */
export function error(
  message: string,
  ctx?: Partial<Pick<ExportDiagnostic, 'nodeId' | 'portId' | 'paramId'>>
): ExportDiagnostic {
  return {
    level: 'error',
    message,
    ...ctx,
  };
}

/**
 * @brief Creates an export diagnostic with level "warning".
 *
 * Optional context may reference a related node, port or parameter.
 *
 * @param message Human-readable warning message.
 * @param ctx Optional diagnostic context.
 * @return Export diagnostic object with warning severity.
 */
export function warning(
  message: string,
  ctx?: Partial<Pick<ExportDiagnostic, 'nodeId' | 'portId' | 'paramId'>>
): ExportDiagnostic {
  return {
    level: 'warning',
    message,
    ...ctx,
  };
}