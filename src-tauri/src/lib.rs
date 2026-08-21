use std::fs;
use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

/// How many bundled translations the current app ships (see data/build-db.mjs,
/// which stamps the same number into the DB's `settings.content_version`). Bump
/// this in lockstep whenever a translation is added to the bundle.
/// 1 = KJV, 2 = +WEB, 4 = +BSB +YLT.
const CONTENT_VERSION: i64 = 4;

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

/// The `content_version` stamped into a DB (1 if the setting predates the field).
async fn db_content_version(target: &Path) -> Result<i64, sqlx::Error> {
    use sqlx::{Connection, Row, SqliteConnection};
    let mut conn =
        SqliteConnection::connect(&format!("sqlite:{}", target.to_string_lossy())).await?;
    let v = sqlx::query("SELECT value FROM settings WHERE key = 'content_version'")
        .fetch_optional(&mut conn)
        .await?
        .and_then(|r| r.get::<String, _>("value").parse::<i64>().ok())
        .unwrap_or(1);
    Ok(v)
}

/// Seed any bundled translations the user's DB is missing (e.g. WEB added in an
/// update) without disturbing their markings. Runs once per content bump, gated
/// by `settings.content_version`. We open our own single sqlx connection here in
/// setup — before tauri-plugin-sql's pool exists — so ATTACH stays on one
/// connection. Only content tables (translations/verses/verses_fts) are touched;
/// user data is never read or modified. Best-effort: any failure is logged and
/// swallowed so the app still launches with whatever content it already has.
async fn seed_translations(target: &Path, bundled: &Path) -> Result<(), sqlx::Error> {
    use sqlx::{Connection, Row, SqliteConnection};

    let url = format!("sqlite:{}", target.to_string_lossy());
    let mut conn = SqliteConnection::connect(&url).await?;

    // Skip fast if this DB is already at the current content version.
    let version: i64 = sqlx::query("SELECT value FROM settings WHERE key = 'content_version'")
        .fetch_optional(&mut conn)
        .await?
        .and_then(|r| r.get::<String, _>("value").parse::<i64>().ok())
        .unwrap_or(1);
    if version >= CONTENT_VERSION {
        return Ok(());
    }

    let attach = format!(
        "ATTACH DATABASE '{}' AS seed",
        bundled.to_string_lossy().replace('\'', "''")
    );
    sqlx::query(&attach).execute(&mut conn).await?;

    // Older DBs predate the expanded translation-metadata columns; add any that
    // are missing so the WEB row's metadata copies across intact. Ignore errors
    // (column already exists).
    for (col, ty) in [
        ("public_domain", "INTEGER"),
        ("license_url", "TEXT"),
        ("copyright", "TEXT"),
        ("attribution", "TEXT"),
        ("source_url", "TEXT"),
        ("text_version", "TEXT"),
        ("has_strongs", "INTEGER"),
    ] {
        let _ = sqlx::query(&format!("ALTER TABLE translations ADD COLUMN {col} {ty}"))
            .execute(&mut conn)
            .await;
    }

    // A translation is "missing" if the user's DB has no verses for it yet.
    let present = "SELECT DISTINCT translation_id FROM main.verses";

    sqlx::query("BEGIN").execute(&mut conn).await?;
    let seeded: Result<(), sqlx::Error> = async {
        sqlx::query(&format!(
            "INSERT OR IGNORE INTO main.translations
               (id, abbrev, name, language, license, is_local, public_domain,
                license_url, copyright, attribution, source_url, text_version, has_strongs)
             SELECT id, abbrev, name, language, license, is_local, public_domain,
                    license_url, copyright, attribution, source_url, text_version, has_strongs
             FROM seed.translations
             WHERE id NOT IN ({present})"
        ))
        .execute(&mut conn)
        .await?;

        sqlx::query(&format!(
            "INSERT INTO main.verses (translation_id, book_id, chapter, verse, text)
             SELECT translation_id, book_id, chapter, verse, text FROM seed.verses
             WHERE translation_id NOT IN ({present})"
        ))
        .execute(&mut conn)
        .await?;

        // Rebuild the external-content FTS index to cover the new verses.
        sqlx::query("INSERT INTO main.verses_fts(verses_fts) VALUES('rebuild')")
            .execute(&mut conn)
            .await?;

        sqlx::query("INSERT INTO settings (key, value) VALUES ('content_version', ?)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value")
            .bind(CONTENT_VERSION.to_string())
            .execute(&mut conn)
            .await?;
        Ok(())
    }
    .await;

    match seeded {
        Ok(()) => {
            sqlx::query("COMMIT").execute(&mut conn).await?;
        }
        Err(e) => {
            let _ = sqlx::query("ROLLBACK").execute(&mut conn).await;
            let _ = sqlx::query("DETACH DATABASE seed").execute(&mut conn).await;
            return Err(e);
        }
    }
    let _ = sqlx::query("DETACH DATABASE seed").execute(&mut conn).await;
    Ok(())
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
            let bundled = app
                .path()
                .resolve("db/marginalia.db", BaseDirectory::Resource)?;
            if !target.exists() {
                // Fresh install: the bundled DB already carries every translation.
                fs::copy(&bundled, &target)?;
            } else {
                // Existing install: bring older DBs up to the current content set
                // (e.g. add WEB) without touching the user's markings. Best-effort.
                let stale = tauri::async_runtime::block_on(db_content_version(&target))
                    .map(|v| v < CONTENT_VERSION)
                    .unwrap_or(false);
                if stale {
                    // ATTACH a writable temp copy (never write to the read-only bundle).
                    let tmp = config_dir.join("seed-content.tmp.db");
                    if fs::copy(&bundled, &tmp).is_ok() {
                        if let Err(e) =
                            tauri::async_runtime::block_on(seed_translations(&target, &tmp))
                        {
                            eprintln!("Marginalia: content seed failed (continuing): {e}");
                        }
                        let _ = fs::remove_file(&tmp);
                    }
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
