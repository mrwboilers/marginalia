import { isTauri } from './provider';

// Data-safety backups. In the native app, a copy of the export JSON is written to
// a managed `backups/` folder next to the database (the Rust `write_backup` command
// keeps the newest 20). In browser-dev there's no filesystem, so a manual backup
// falls back to a normal download and auto-backup is a no-op.

function backupFilename(): string {
  // ISO timestamp, filesystem-safe (no ':' / '.'), and lexically sortable by time.
  return `marginalia-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
}

/** Silent backup used on launch — native only; does nothing in the browser. */
export async function autoBackup(json: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('write_backup', { filename: backupFilename(), json });
  } catch (err) {
    console.error('Auto-backup failed:', err);
  }
}

/** Explicit backup from the toolbar. Native: writes to the backups folder. */
export async function manualBackup(json: string): Promise<'saved' | 'downloaded'> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('write_backup', { filename: backupFilename(), json });
    return 'saved';
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename();
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

/** Reveal the backups folder in the OS file manager (native only). */
export async function revealBackups(): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  const dir = await invoke<string>('backups_dir');
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
  await revealItemInDir(dir);
}

export const nativeApp = isTauri();
