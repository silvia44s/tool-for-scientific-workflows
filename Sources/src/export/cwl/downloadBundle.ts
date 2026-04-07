import JSZip from 'jszip';
import type { CwlBundle } from './types';

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