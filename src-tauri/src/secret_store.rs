//! Device-bound secret storage backed by the operating system credential vault.

use tauri_plugin_keyring_store::KeyringExt;

const ACCOUNT_PREFIX: &str = "llmira.";
const MAX_ACCOUNT_LEN: usize = 512;

fn validate_account(account: &str) -> Result<(), String> {
    if account.starts_with(ACCOUNT_PREFIX)
        && account.len() <= MAX_ACCOUNT_LEN
        && account.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b':' | b'_' | b'-' | b'%')
        })
    {
        Ok(())
    } else {
        Err("invalid LLMira secret account".to_string())
    }
}

/// Read one application-scoped secret from the platform credential vault.
#[tauri::command]
pub fn read_device_secret(
    app: tauri::AppHandle,
    account: String,
) -> Result<Option<String>, String> {
    validate_account(&account)?;
    app.keyring()
        .store
        .get_password(&account)
        .map_err(|error| error.to_string())
}

/// Save one application-scoped secret in the platform credential vault.
#[tauri::command]
pub fn save_device_secret(
    app: tauri::AppHandle,
    account: String,
    secret: String,
) -> Result<(), String> {
    validate_account(&account)?;
    app.keyring()
        .store
        .set_password(&account, &secret)
        .map_err(|error| error.to_string())
}

/// Delete one application-scoped secret from the platform credential vault.
#[tauri::command]
pub fn delete_device_secret(app: tauri::AppHandle, account: String) -> Result<(), String> {
    validate_account(&account)?;
    app.keyring()
        .store
        .delete(&account)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::validate_account;

    #[test]
    fn accepts_only_llmira_scoped_accounts() {
        assert!(validate_account("llmira.provider:default").is_ok());
        assert!(validate_account("llmira.provider:mcp%3Aone").is_ok());
        assert!(validate_account("other.provider:default").is_err());
        assert!(validate_account("llmira.provider/default").is_err());
    }
}
