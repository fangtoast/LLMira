//! LLMira native MCP runtime based on the official rmcp v3 client.

use std::{collections::HashMap, process::Stdio, sync::Arc, time::{Duration, SystemTime, UNIX_EPOCH}};

use http::{HeaderName, HeaderValue};
use rmcp::{
    model::{CallToolRequestParams, ClientInfo, ProtocolVersion},
    service::{ClientLifecycleMode, ClientServiceExt, RoleClient, RunningService},
    transport::{streamable_http_client::StreamableHttpClientTransportConfig, StreamableHttpClientTransport},
};
#[cfg(not(mobile))]
use rmcp::transport::TokioChildProcess;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tokio::sync::{oneshot, Mutex};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NameValueEntry {
    id: String,
    name: String,
    value: Option<String>,
    sensitive: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
    id: String,
    name: String,
    description: String,
    transport: String,
    url: String,
    command: String,
    args: Vec<String>,
    cwd: String,
    env: Vec<NameValueEntry>,
    headers: Vec<NameValueEntry>,
    auth_mode: String,
    enabled: bool,
    disabled_tools: Vec<String>,
    timeout_seconds: u64,
    created_at: u64,
    updated_at: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConnectionInput {
    config: McpServerConfig,
    bearer_token: Option<String>,
    sensitive_headers: Option<HashMap<String, String>>,
    environment: Option<HashMap<String, String>>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDescriptor {
    server_id: String,
    server_name: String,
    name: String,
    description: Option<String>,
    input_schema: Value,
    wire_name: String,
    enabled: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSnapshot {
    server_id: String,
    status: String,
    fingerprint: Option<String>,
    tools: Vec<ToolDescriptor>,
    error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeLogEntry {
    id: String,
    server_id: String,
    level: String,
    message: String,
    created_at: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallResponse {
    content: Value,
    is_error: bool,
    summary: String,
}

struct Session {
    fingerprint: String,
    client: RunningService<RoleClient, ClientInfo>,
    tools: Vec<ToolDescriptor>,
}

#[derive(Default)]
pub struct McpRuntimeState {
    sessions: Mutex<HashMap<String, Arc<Mutex<Session>>>>,
    connection_gates: Mutex<HashMap<String, Arc<Mutex<()>>>>,
    cancellations: Mutex<HashMap<String, oneshot::Sender<()>>>,
    logs: Mutex<Vec<RuntimeLogEntry>>,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
}

fn lifecycle() -> ClientLifecycleMode {
    ClientLifecycleMode::Auto {
        preferred_versions: vec![ProtocolVersion::V_2026_07_28],
        legacy_version: Some(ProtocolVersion::V_2025_11_25),
    }
}

fn fnv1a(value: &str) -> String {
    let mut hash: u32 = 0x811c9dc5;
    for unit in value.encode_utf16() {
        hash ^= unit as u32;
        hash = hash.wrapping_mul(0x01000193);
    }
    let mut value = hash;
    let mut digits = Vec::new();
    loop {
        let digit = (value % 36) as u8;
        digits.push(if digit < 10 { b'0' + digit } else { b'a' + digit - 10 });
        value /= 36;
        if value == 0 { break; }
    }
    digits.reverse();
    let encoded = String::from_utf8(digits).expect("base36 is ASCII");
    format!("{:0>7}", encoded).chars().rev().take(7).collect::<String>().chars().rev().collect()
}

fn wire_name(server_id: &str, tool_name: &str) -> String {
    let slug: String = tool_name
        .chars()
        .map(|character| if character.is_ascii_alphanumeric() || character == '_' || character == '-' { character } else { '_' })
        .collect::<String>()
        .trim_matches('_')
        .chars()
        .take(42)
        .collect();
    let slug = if slug.is_empty() { "tool" } else { &slug };
    let full = format!("mcp_{}_{}", slug, fnv1a(&format!("{}\0{}", server_id, tool_name)));
    full.chars().take(63).collect()
}

fn config_fingerprint(input: &McpConnectionInput) -> String {
    format!("{}:{}:{}:{}", input.config.id, input.config.updated_at, input.config.transport, input.config.url)
}

async fn append_log(state: &McpRuntimeState, server_id: &str, level: &str, message: impl Into<String>) {
    let mut logs = state.logs.lock().await;
    logs.insert(0, RuntimeLogEntry {
        id: uuid::Uuid::new_v4().to_string(),
        server_id: server_id.to_string(),
        level: level.to_string(),
        message: message.into(),
        created_at: now_ms(),
    });
    logs.truncate(200);
}

fn describe_tools(input: &McpConnectionInput, tools: Vec<rmcp::model::Tool>) -> Vec<ToolDescriptor> {
    tools.into_iter().map(|tool| {
        let name = tool.name.to_string();
        ToolDescriptor {
            server_id: input.config.id.clone(),
            server_name: input.config.name.clone(),
            wire_name: wire_name(&input.config.id, &name),
            enabled: !input.config.disabled_tools.contains(&name),
            name,
            description: tool.description.map(|description| description.to_string()),
            input_schema: Value::Object((*tool.input_schema).clone()),
        }
    }).collect()
}

async fn open_client(input: &McpConnectionInput) -> Result<RunningService<RoleClient, ClientInfo>, String> {
    if input.config.transport == "streamable_http" {
        if input.config.url.trim().is_empty() { return Err("请填写 MCP 服务 URL。".into()); }
        let mut headers = HashMap::new();
        for entry in &input.config.headers {
            let value = if entry.sensitive.unwrap_or(false) {
                input.sensitive_headers.as_ref().and_then(|values| values.get(&entry.name)).cloned()
            } else {
                entry.value.clone()
            };
            if let Some(value) = value {
                let name = HeaderName::try_from(entry.name.as_str()).map_err(|_| format!("无效请求头：{}", entry.name))?;
                let value = HeaderValue::try_from(value).map_err(|_| format!("请求头值无效：{}", entry.name))?;
                headers.insert(name, value);
            }
        }
        let mut config = StreamableHttpClientTransportConfig::with_uri(input.config.url.clone()).custom_headers(headers);
        if input.config.auth_mode == "bearer" {
            if let Some(token) = input.bearer_token.as_ref().filter(|token| !token.is_empty()) {
                config = config.auth_header(token.clone());
            }
        }
        let transport = StreamableHttpClientTransport::from_config(config);
        return ClientInfo::default().serve_with_lifecycle(transport, lifecycle()).await.map_err(|error| error.to_string());
    }

    #[cfg(not(mobile))]
    {
        if input.config.command.trim().is_empty() { return Err("请填写 STDIO 启动命令。".into()); }
        let mut command = tokio::process::Command::new(&input.config.command);
        command.args(&input.config.args);
        if !input.config.cwd.trim().is_empty() { command.current_dir(&input.config.cwd); }
        for (name, value) in input.environment.as_ref().into_iter().flatten() { command.env(name, value); }
        let (transport, _stderr) = TokioChildProcess::builder(command).stderr(Stdio::null()).spawn().map_err(|error| error.to_string())?;
        return ClientInfo::default().serve_with_lifecycle(transport, lifecycle()).await.map_err(|error| error.to_string());
    }

    #[cfg(mobile)]
    Err("Android 不支持本地 STDIO MCP，请改用远程 HTTP。".into())
}

async fn connect_inner(state: &McpRuntimeState, input: McpConnectionInput, force: bool) -> RuntimeSnapshot {
    let server_id = input.config.id.clone();
    let fingerprint = config_fingerprint(&input);
    let gate = {
        let mut gates = state.connection_gates.lock().await;
        gates.entry(server_id.clone()).or_insert_with(|| Arc::new(Mutex::new(()))).clone()
    };
    let _guard = gate.lock().await;

    if !force {
        if let Some(session) = state.sessions.lock().await.get(&server_id).cloned() {
            let session = session.lock().await;
            if session.fingerprint == fingerprint && !session.client.is_closed() {
                return RuntimeSnapshot { server_id, status: "connected".into(), fingerprint: Some(fingerprint), tools: session.tools.clone(), error: None };
            }
        }
    }

    if let Some(session) = state.sessions.lock().await.remove(&server_id) {
        let mut session = session.lock().await;
        let _ = session.client.close_with_timeout(Duration::from_secs(2)).await;
    }

    match open_client(&input).await {
        Ok(client) => match client.list_all_tools().await {
            Ok(listed) => {
                let tools = describe_tools(&input, listed);
                let count = tools.len();
                state.sessions.lock().await.insert(server_id.clone(), Arc::new(Mutex::new(Session { fingerprint: fingerprint.clone(), client, tools: tools.clone() })));
                append_log(state, &server_id, "info", format!("已连接，发现 {} 个工具。", count)).await;
                RuntimeSnapshot { server_id, status: "connected".into(), fingerprint: Some(fingerprint), tools, error: None }
            }
            Err(error) => RuntimeSnapshot { server_id, status: "error".into(), fingerprint: Some(fingerprint), tools: vec![], error: Some(error.to_string()) },
        },
        Err(error) => {
            append_log(state, &server_id, "error", error.clone()).await;
            RuntimeSnapshot { server_id, status: "error".into(), fingerprint: Some(fingerprint), tools: vec![], error: Some(error) }
        }
    }
}

#[tauri::command]
pub async fn mcp_connect(state: tauri::State<'_, McpRuntimeState>, input: McpConnectionInput) -> Result<RuntimeSnapshot, String> {
    Ok(connect_inner(state.inner(), input, false).await)
}

#[tauri::command]
pub async fn mcp_test_connection(state: tauri::State<'_, McpRuntimeState>, input: McpConnectionInput) -> Result<RuntimeSnapshot, String> {
    Ok(connect_inner(state.inner(), input, true).await)
}

#[tauri::command]
pub async fn mcp_disconnect(state: tauri::State<'_, McpRuntimeState>, server_id: String) -> Result<(), String> {
    if let Some(session) = state.sessions.lock().await.remove(&server_id) {
        let mut session = session.lock().await;
        let _ = session.client.close_with_timeout(Duration::from_secs(2)).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn mcp_list_tools(state: tauri::State<'_, McpRuntimeState>, input: McpConnectionInput) -> Result<Vec<ToolDescriptor>, String> {
    let snapshot = connect_inner(state.inner(), input, false).await;
    if snapshot.status == "connected" { Ok(snapshot.tools) } else { Err(snapshot.error.unwrap_or_else(|| "MCP 连接失败".into())) }
}

#[tauri::command]
pub async fn mcp_call_tool(
    state: tauri::State<'_, McpRuntimeState>,
    input: McpConnectionInput,
    tool_name: String,
    args: Value,
    call_id: String,
    timeout_ms: u64,
) -> Result<ToolCallResponse, String> {
    let snapshot = connect_inner(state.inner(), input.clone(), false).await;
    if snapshot.status != "connected" { return Err(snapshot.error.unwrap_or_else(|| "MCP 连接失败".into())); }
    let session = state.sessions.lock().await.get(&input.config.id).cloned().ok_or_else(|| "MCP 会话不可用".to_string())?;
    let arguments: Map<String, Value> = args.as_object().cloned().unwrap_or_default();
    let request = CallToolRequestParams::new(tool_name).with_arguments(arguments);
    let (cancel_tx, cancel_rx) = oneshot::channel();
    state.cancellations.lock().await.insert(call_id.clone(), cancel_tx);
    let session = session.lock().await;
    let result = tokio::select! {
        result = tokio::time::timeout(Duration::from_millis(timeout_ms.clamp(5_000, 600_000)), session.client.call_tool(request)) => {
            match result { Ok(value) => value.map_err(|error| error.to_string()), Err(_) => Err("MCP 工具调用超时".into()) }
        },
        _ = cancel_rx => Err("MCP 工具调用已取消".into()),
    };
    state.cancellations.lock().await.remove(&call_id);
    let result = result?;
    let content = serde_json::to_value(&result).map_err(|error| error.to_string())?;
    let summary = serde_json::to_string(&result.structured_content.as_ref().unwrap_or(&content)).unwrap_or_else(|_| "工具已完成".into());
    Ok(ToolCallResponse { content, is_error: result.is_error.unwrap_or(false), summary: summary.chars().take(2_000).collect() })
}

#[tauri::command]
pub async fn mcp_cancel_call(state: tauri::State<'_, McpRuntimeState>, call_id: String) -> Result<(), String> {
    if let Some(sender) = state.cancellations.lock().await.remove(&call_id) { let _ = sender.send(()); }
    Ok(())
}

#[tauri::command]
pub async fn mcp_read_logs(state: tauri::State<'_, McpRuntimeState>, server_id: Option<String>) -> Result<Vec<RuntimeLogEntry>, String> {
    Ok(state.logs.lock().await.iter().filter(|entry| server_id.as_ref().map(|id| id == &entry.server_id).unwrap_or(true)).cloned().collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn stdio_fixture() -> McpConnectionInput {
        let script = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("scripts").join("test-mcp-stdio.mjs");
        McpConnectionInput {
            config: McpServerConfig {
                id: "fixture".into(), name: "Fixture".into(), description: String::new(), transport: "stdio".into(),
                url: String::new(), command: "node".into(), args: vec![script.to_string_lossy().into_owned()], cwd: String::new(),
                env: vec![], headers: vec![], auth_mode: "none".into(), enabled: true, disabled_tools: vec![],
                timeout_seconds: 60, created_at: 1, updated_at: 1,
            },
            bearer_token: None,
            sensitive_headers: None,
            environment: None,
        }
    }

    #[test]
    fn wire_names_match_the_web_contract() {
        assert_eq!(wire_name("server-a", "search"), "mcp_search_0htbgq8");
        assert!(wire_name("服务器", "获取天气").is_ascii());
        assert!(wire_name("server", &"x".repeat(100)).len() <= 63);
    }

    #[tokio::test]
    async fn controlled_stdio_server_discovers_and_calls_tools() {
        let input = stdio_fixture();
        let state = McpRuntimeState::default();
        let snapshot = connect_inner(&state, input.clone(), false).await;
        assert_eq!(snapshot.status, "connected", "{:?}", snapshot.error);
        assert_eq!(snapshot.tools.len(), 1);
        assert_eq!(snapshot.tools[0].name, "echo");

        let session = state.sessions.lock().await.get("fixture").cloned().expect("session");
        let session = session.lock().await;
        let result = session.client.call_tool(CallToolRequestParams::new("echo").with_arguments(Map::from_iter([("text".into(), Value::String("hello".into()))]))).await.expect("call");
        let serialized = serde_json::to_string(&result).expect("serialize");
        assert!(serialized.contains("hello"));
    }
}
