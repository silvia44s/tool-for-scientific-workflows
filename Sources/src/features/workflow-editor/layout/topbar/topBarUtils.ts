/**
 * @file topBarUtils.ts
 * @brief Contains small utility helpers used by the workflow editor top bar.
 * @author Silvia Šlachtovská
 */

/**
 * @brief Downloads the given data as a formatted JSON file.
 *
 * @param filename Name of the output file.
 * @param data Data to serialize and download.
 */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}


export async function downloadScriptsZip(runDir: string): Promise<void> {
  const url = new URL('http://127.0.0.1:8000/api/download-scripts');
  url.searchParams.set('run_dir', runDir);

  const res = await fetch(url.toString());

  if (!res.ok) {
    let message = 'Failed to download scripts bundle.';
    try {
      const data = await res.json();
      message = data.detail ?? message;
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }

  const blob = await res.blob();

  const contentDisposition = res.headers.get('Content-Disposition') ?? '';
  const match = contentDisposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? 'workflow_scripts.zip';

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}