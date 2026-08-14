//! LLMira Tauri 2 shell for Windows and Android.

use tauri::Manager;

mod mcp_runtime;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(mcp_runtime::McpRuntimeState::default())
        .invoke_handler(tauri::generate_handler![
            mcp_runtime::mcp_connect,
            mcp_runtime::mcp_disconnect,
            mcp_runtime::mcp_test_connection,
            mcp_runtime::mcp_list_tools,
            mcp_runtime::mcp_call_tool,
            mcp_runtime::mcp_cancel_call,
            mcp_runtime::mcp_read_logs,
        ])
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
