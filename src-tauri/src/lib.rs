use std::fs;
use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

fn backups_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("backups"))
}

/// Keep only the newest `keep` .json backups (filenames are ISO timestamps, so
/// sorting them lexically is chronological).
fn prune(dir: &Path, keep: usize) {
    let mut files: Vec<PathBuf> = match fs::read_dir(dir) {
        Ok(rd) => rd
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().map(|x| x == "json").unwrap_or(false))
            .collect(),
        Err(_) => return,
    };
    if files.len() <= keep {
        return;
    }
    files.sort();
    for old in &files[..files.len() - keep] {
        let _ = fs::remove_file(old);
    }
}

/// Write a timestamped backup of the user's data JSON into the app's backups
/// folder, pruning to the newest 20.
#[tauri::command]
fn write_backup(app: AppHandle, filename: String, json: String) -> Result<(), String> {
    let dir = backups_path(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe = filename.replace(['/', '\\'], "-");
    fs::write(dir.join(safe), json).map_err(|e| e.to_string())?;
    prune(&dir, 20);
    Ok(())
}

/// The path to the backups folder (created if needed), for revealing in the OS
/// file manager.
#[tauri::command]
fn backups_dir(app: AppHandle) -> Result<String, String> {
    let dir = backups_path(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![write_backup, backups_dir])
        .setup(|app| {
            // Ship the pre-built KJV database as a read-only resource, then copy it
            // into the writable app-config dir on first launch. From then on the app
            // opens `sqlite:marginalia.db` there and reads/writes the user's markings.
            let config_dir = app.path().app_config_dir()?;
            fs::create_dir_all(&config_dir)?;
            let target = config_dir.join("marginalia.db");
            if !target.exists() {
                let bundled = app
                    .path()
                    .resolve("db/marginalia.db", BaseDirectory::Resource)?;
                fs::copy(&bundled, &target)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
