//! LLMira Tauri 2 shell for Windows and Android.

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:llmira-cache.db",
                    vec![
                        tauri_plugin_sql::Migration {
                            version: 1,
                            description: "create offline drafts and outbox",
                            sql: include_str!("../migrations/001_offline_cache.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 2,
                            description: "create personal provider chat and image runtime",
                            sql: include_str!("../migrations/002_personal_runtime.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .setup(|app| {
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("stronghold-salt.txt");
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build(),
            )?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running LLMira");
}
