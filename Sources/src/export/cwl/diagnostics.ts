import type { ExportDiagnostic } from './types';

export function hasErrors(diagnostics: ExportDiagnostic[]): boolean {
  return diagnostics.some(d => d.level === 'error');
}

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