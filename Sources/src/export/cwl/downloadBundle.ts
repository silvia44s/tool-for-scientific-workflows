/**
 * @file downloadBundle.ts
 * @brief Provides browser-side download of generated CWL export bundles as ZIP archives.
 *
 * This file contains the utility responsible for packaging generated CWL files
 * into a ZIP archive and triggering its download in the browser.
 */

import JSZip from 'jszip';
import type { CwlBundle } from './types';

/**
 * @brief Packages a CWL bundle into a ZIP archive and triggers file download.
 *
 * All generated files contained in the export bundle are added to a ZIP archive.
 * The archive is then converted to a Blob, exposed through an object URL and
 * downloaded using a temporary anchor element.
 *
 * @param bundle Exported CWL bundle to package.
 * @param filename Target filename of the downloaded ZIP archive.
 * @return Promise resolved after the ZIP archive is generated and download is triggered.
 */
export async function downloadCwlBundleZip(
  bundle: CwlBundle,
  filename: string
): Promise<void> {
  const zip = new JSZip();

  for (const file of bundle.files) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}