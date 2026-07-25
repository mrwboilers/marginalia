use std::fs;
use tauri::path::BaseDirectory;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
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
