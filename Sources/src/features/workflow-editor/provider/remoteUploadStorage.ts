/**
 * @file remoteUploadStorage.ts
 * @brief Storage management for remote upload settings in the workflow editor.
 * @author Silvia Šlachtovská
 * 
 * The settings are stored in the browser's localStorage to persist across sessions.
 * 
 */
export type RemoteUploadSettings = {
  remoteHost: string;
  remoteUser: string;
  remotePath: string;
  remoteKeyPath: string;
};

const REMOTE_UPLOAD_STORAGE_KEY = 'workflow-editor.remote-upload-settings';

export function loadRemoteUploadSettings(): RemoteUploadSettings {
  try {
    const raw = localStorage.getItem(REMOTE_UPLOAD_STORAGE_KEY);

    if (!raw) {
      return {
        remoteHost: '',
        remoteUser: '',
        remotePath: '',
        remoteKeyPath: '',
      };
    }

    const parsed = JSON.parse(raw) as Partial<RemoteUploadSettings>;

    return {
      remoteHost: parsed.remoteHost ?? '',
      remoteUser: parsed.remoteUser ?? '',
      remotePath: parsed.remotePath ?? '',
      remoteKeyPath: parsed.remoteKeyPath ?? '',
    };
  } catch {
    localStorage.removeItem(REMOTE_UPLOAD_STORAGE_KEY);

    return {
      remoteHost: '',
      remoteUser: '',
      remotePath: '',
      remoteKeyPath: '',
    };
  }
}

export function saveRemoteUploadSettings(settings: RemoteUploadSettings) {
  localStorage.setItem(
    REMOTE_UPLOAD_STORAGE_KEY,
    JSON.stringify(settings)
  );
}

export function clearRemoteUploadSettings() {
  localStorage.removeItem(REMOTE_UPLOAD_STORAGE_KEY);
}