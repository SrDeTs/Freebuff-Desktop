use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;

// ─── Data Types ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub default_cwd: String,
    pub model: String,
    pub show_tips: bool,
    pub system_notifications: bool,
    pub ads_enabled: bool,
    pub show_terminal_chrome: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Bootstrap {
    pub user: Option<UserInfo>,
    pub freebuff_version: Option<String>,
    pub freebuff_binary: String,
    pub freebuff_installed: bool,
    pub recent_projects: Vec<ProjectEntry>,
    pub freebuff_settings: HashMap<String, serde_json::Value>,
    pub app_settings: AppSettings,
    pub chats: Vec<ChatItem>,
    pub home_dir: String,
    pub platform: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfo {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectEntry {
    pub path: String,
    pub last_opened: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatItem {
    pub id: String,
    pub project_key: String,
    pub project_path: String,
    pub project_name: String,
    pub first_prompt: String,
    pub message_count: u64,
    pub mtime_ms: f64,
    pub relative_age: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FreebuffBlock {
    pub r#type: String,
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FreebuffMessage {
    pub id: String,
    pub variant: String,
    pub content: Option<String>,
    pub timestamp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocks: Option<Vec<FreebuffBlock>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionInfo {
    pub session_id: String,
    pub cwd: String,
    pub model: Option<String>,
    pub pid: u32,
    pub started_at: f64,
}

// ─── Session Manager ───────────────────────────────────────────────────────

struct SessionEntry {
    child: Child,
    stdin: Option<ChildStdin>,
}

pub struct SessionManager {
    sessions: Mutex<HashMap<String, SessionEntry>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

fn manicode_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/home/user".to_string());
    PathBuf::from(home).join(".config/manicode")
}

fn app_settings_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/home/user".to_string());
    PathBuf::from(home).join(".config/freebuff-desktop/settings.json")
}

fn find_freebuff_binary() -> String {
    let candidates = [
        manicode_dir().join("freebuff").to_string_lossy().to_string(),
        "/usr/local/bin/freebuff".to_string(),
        format!("{}/.local/bin/freebuff", std::env::var("HOME").unwrap_or_default()),
    ];
    for c in &candidates {
        if std::path::Path::new(c).exists() {
            return c.clone();
        }
    }
    candidates[0].clone()
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &std::path::Path) -> Option<T> {
    std::fs::read_to_string(path).ok().and_then(|s| serde_json::from_str(&s).ok())
}

fn save_json<T: Serialize>(path: &std::path::Path, val: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let s = serde_json::to_string_pretty(val).map_err(|e| e.to_string())?;
    std::fs::write(path, s).map_err(|e| e.to_string())
}

fn format_age(ms: f64) -> String {
    let diff = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as f64
        - ms;
    let mins = diff / 60000.0;
    if mins < 60.0 {
        format!("{}m", (mins.max(1.0)) as u64)
    } else if mins < 1440.0 {
        format!("{}h", (mins / 60.0) as u64)
    } else if mins < 43200.0 {
        format!("{}d", (mins / 1440.0) as u64)
    } else {
        format!("{}mo", (mins / 43200.0) as u64)
    }
}

fn default_settings() -> AppSettings {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/home/user".to_string());
    AppSettings {
        default_cwd: home.clone(),
        model: "minimax/minimax-m3".to_string(),
        show_tips: true,
        system_notifications: true,
        ads_enabled: true,
        show_terminal_chrome: true,
    }
}

#[derive(Debug, Deserialize)]
struct ManicodeSettings {
    #[serde(default)]
    ads_enabled: Option<bool>,
    #[serde(default)]
    freebuff_model: Option<String>,
    #[serde(default)]
    mode: Option<String>,
    #[serde(default)]
    has_submitted_first_prompt: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct Credentials {
    #[serde(default)]
    default: Option<CredentialUser>,
}

#[derive(Debug, Deserialize)]
struct CredentialUser {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatMeta {
    #[serde(default)]
    first_prompt: Option<String>,
    #[serde(default)]
    message_count: Option<u64>,
    #[serde(default)]
    messages_mtime_ms: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct RunState {
    #[serde(default)]
    session_state: Option<SessionState>,
}

#[derive(Debug, Deserialize)]
struct SessionState {
    #[serde(default)]
    file_context: Option<FileContext>,
}

#[derive(Debug, Deserialize)]
struct FileContext {
    #[serde(default)]
    project_root: Option<String>,
    #[serde(default)]
    cwd: Option<String>,
}

// ─── Tauri Commands ────────────────────────────────────────────────────────

#[tauri::command]
fn get_bootstrap() -> Result<Bootstrap, String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/home/user".to_string());
    let manicode = manicode_dir();

    // Freebuff binary
    let binary = find_freebuff_binary();
    let installed = std::path::Path::new(&binary).exists();

    // Version
    let meta_path = manicode.join("freebuff-metadata.json");
    let version: Option<String> = read_json::<HashMap<String, String>>(&meta_path)
        .and_then(|m| m.get("version").cloned());

    // Settings
    let fb_settings: HashMap<String, serde_json::Value> =
        read_json(&manicode.join("settings.json")).unwrap_or_default();

    // Recent projects
    let recent: Vec<ProjectEntry> =
        read_json(&manicode.join("recent-projects.json")).unwrap_or_default();

    // Credentials
    let user = read_json::<Credentials>(&manicode.join("credentials.json"))
        .and_then(|c| c.default)
        .filter(|u| u.name.is_some() || u.email.is_some())
        .map(|u| UserInfo {
            name: u.name.unwrap_or_else(|| "Freebuff User".to_string()),
            email: u.email.unwrap_or_default(),
        });

    // App settings
    let app_settings: AppSettings =
        read_json(&app_settings_path()).unwrap_or_else(default_settings);

    // Chats
    let chats = list_chat_sessions_internal(&manicode);

    let final_settings = AppSettings {
        model: app_settings.model.clone(),
        ads_enabled: fb_settings
            .get("adsEnabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        ..app_settings
    };

    Ok(Bootstrap {
        user,
        freebuff_version: version,
        freebuff_binary: binary,
        freebuff_installed: installed,
        recent_projects: recent,
        freebuff_settings: fb_settings,
        app_settings: final_settings,
        chats,
        home_dir: home,
        platform: if cfg!(target_os = "macos") {
            "darwin".to_string()
        } else if cfg!(target_os = "windows") {
            "win32".to_string()
        } else {
            "linux".to_string()
        },
    })
}

fn list_chat_sessions_internal(manicode: &PathBuf) -> Vec<ChatItem> {
    let projects_root = manicode.join("projects");
    if !projects_root.exists() {
        return vec![];
    }

    let mut out = vec![];
    let Ok(entries) = std::fs::read_dir(&projects_root) else {
        return vec![];
    };

    for entry in entries.flatten() {
        let project_key = entry.file_name().to_string_lossy().to_string();
        let chats_dir = entry.path().join("chats");
        if !chats_dir.exists() {
            continue;
        }

        let Ok(chat_entries) = std::fs::read_dir(&chats_dir) else {
            continue;
        };

        for chat_entry in chat_entries.flatten() {
            let chat_dir = chat_entry.path();
            if !chat_dir.is_dir() {
                continue;
            }

            let meta_path = chat_dir.join("chat-meta.json");
            if !meta_path.exists() {
                continue;
            }

            let meta: Option<ChatMeta> = read_json(&meta_path);
            let meta = match meta {
                Some(m) => m,
                None => continue,
            };

            let mtime_ms = meta.messages_mtime_ms.unwrap_or_else(|| {
                chat_dir.metadata().ok().and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as f64)
                    .unwrap_or(0.0)
            });

            // Resolve project path from run-state.json
            let run_state: Option<RunState> = read_json(&chat_dir.join("run-state.json"));
            let project_path = run_state
                .and_then(|r| r.session_state)
                .and_then(|s| s.file_context)
                .and_then(|f| f.project_root.or(f.cwd))
                .unwrap_or_else(|| project_key.clone());

            let project_name = if project_path == project_key {
                project_key.clone()
            } else {
                std::path::Path::new(&project_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| project_key.clone())
            };

            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as f64;
            let age = if mtime_ms > 0.0 {
                format_age(mtime_ms)
            } else {
                format_age(now)
            };

            out.push(ChatItem {
                id: chat_entry.file_name().to_string_lossy().to_string(),
                project_key: project_key.clone(),
                project_path: project_path.clone(),
                project_name,
                first_prompt: meta.first_prompt.unwrap_or_else(|| "Untitled".to_string()),
                message_count: meta.message_count.unwrap_or(0),
                mtime_ms,
                relative_age: age,
            });
        }
    }

    out.sort_by(|a, b| b.mtime_ms.partial_cmp(&a.mtime_ms).unwrap_or(std::cmp::Ordering::Equal));
    out
}

#[tauri::command]
fn list_chats() -> Vec<ChatItem> {
    list_chat_sessions_internal(&manicode_dir())
}

#[tauri::command]
fn read_chat(project_key: String, chat_id: String) -> Vec<FreebuffMessage> {
    let path = manicode_dir()
        .join("projects")
        .join(&project_key)
        .join("chats")
        .join(&chat_id)
        .join("chat-messages.json");

    match std::fs::read_to_string(&path) {
        Ok(s) => {
            serde_json::from_str(&s).unwrap_or_default()
        }
        Err(_) => vec![],
    }
}

#[tauri::command]
fn get_settings() -> AppSettings {
    read_json(&app_settings_path()).unwrap_or_else(default_settings)
}

#[tauri::command]
fn save_settings(partial: AppSettings) -> AppSettings {
    let merged = AppSettings {
        default_cwd: partial.default_cwd,
        model: partial.model.clone(),
        show_tips: partial.show_tips,
        system_notifications: partial.system_notifications,
        ads_enabled: partial.ads_enabled,
        show_terminal_chrome: partial.show_terminal_chrome,
    };

    let _ = save_json(&app_settings_path(), &merged);

    // Sync model + adsEnabled to manicode settings
    if let Ok(contents) = std::fs::read_to_string(manicode_dir().join("settings.json")) {
        if let Ok(mut manicode) = serde_json::from_str::<HashMap<String, serde_json::Value>>(&contents) {
            manicode.insert("freebuffModel".to_string(), serde_json::Value::String(partial.model));
            manicode.insert("adsEnabled".to_string(), serde_json::Value::Bool(partial.ads_enabled));
            let _ = save_json(&manicode_dir().join("settings.json"), &manicode);
        }
    }

    merged
}

#[tauri::command]
fn path_exists(p: String) -> bool {
    std::path::Path::new(&p).exists()
}

#[tauri::command]
fn list_dirs(dir: String) -> Vec<DirEntry> {
    let path = std::path::Path::new(&dir);
    if !path.is_dir() {
        return vec![];
    }
    let mut out = vec![];
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    if !name.starts_with('.') {
                        out.push(DirEntry {
                            name: name.to_string(),
                            path: entry.path().to_string_lossy().to_string(),
                        });
                        if out.len() >= 50 {
                            break;
                        }
                    }
                }
            }
        }
    }
    out
}

#[tauri::command]
fn manicode_path() -> String {
    manicode_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn check_freebuff() -> bool {
    std::path::Path::new(&find_freebuff_binary()).exists()
}

#[tauri::command]
fn freebuff_login() -> Result<(), String> {
    let binary = find_freebuff_binary();
    Command::new(&binary)
        .arg("login")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to launch freebuff login: {}", e))?;
    Ok(())
}

// ─── Session Commands (with process management) ────────────────────────────

#[tauri::command]
fn start_session(
    app: tauri::AppHandle,
    session_id: String,
    cwd: String,
    model: Option<String>,
    continue_id: Option<String>,
) -> Result<SessionInfo, String> {
    let binary = find_freebuff_binary();
    if !std::path::Path::new(&binary).exists() {
        return Err("Freebuff CLI not found".to_string());
    }

    let mut cmd = Command::new(&binary);
    cmd.current_dir(&cwd);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("FORCE_COLOR", "3");
    cmd.env("FREEBUFF_MODEL", model.as_deref().unwrap_or("minimax/minimax-m3"));

    if let Some(cid) = &continue_id {
        cmd.arg("--continue").arg(cid);
    }

    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to start Freebuff: {}", e))?;

    let stdin = child.stdin.take();

    // Read stdout byte-by-byte and emit via events.
    // When the pipe closes (EOF), emit session:exit.
    let app_handle = app.clone();
    let sid = session_id.clone();
    if let Some(mut stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match stdout.read(&mut buf) {
                    Ok(0) => {
                        // EOF — process exited
                        let _ = app_handle.emit("session:exit", serde_json::json!({
                            "sessionId": sid,
                            "exitCode": 0,
                        }));
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_handle.emit("session:data", serde_json::json!({
                            "sessionId": sid,
                            "data": data,
                        }));
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // Read stderr byte-by-byte
    let app_handle2 = app.clone();
    let sid2 = session_id.clone();
    if let Some(mut stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match stderr.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_handle2.emit("session:data", serde_json::json!({
                            "sessionId": sid2,
                            "data": data,
                        }));
                    }
                    Err(_) => break,
                }
            }
        });
    }

    let pid = child.id();

    // Store child in session manager
    if let Some(state) = app.try_state::<SessionManager>() {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(session_id.clone(), SessionEntry { child, stdin });
    }

    Ok(SessionInfo {
        session_id,
        cwd,
        model,
        pid,
        started_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as f64,
    })
}

#[tauri::command]
fn write_session(app: tauri::AppHandle, session_id: String, data: String) -> Result<(), String> {
    if let Some(state) = app.try_state::<SessionManager>() {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(entry) = sessions.get_mut(&session_id) {
            if let Some(stdin) = &mut entry.stdin {
                write!(stdin, "{}", data).map_err(|e| e.to_string())?;
                stdin.flush().map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn kill_session(app: tauri::AppHandle, session_id: String) -> Result<(), String> {
    if let Some(state) = app.try_state::<SessionManager>() {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(mut entry) = sessions.remove(&session_id) {
            let _ = entry.child.kill();
            let _ = entry.child.wait();
            let _ = app.emit("session:exit", serde_json::json!({
                "sessionId": session_id,
                "exitCode": 0,
            }));
        }
    }
    Ok(())
}

#[tauri::command]
fn list_sessions(app: tauri::AppHandle) -> Vec<SessionInfo> {
    if let Some(state) = app.try_state::<SessionManager>() {
        let sessions = state.sessions.lock().unwrap();
        return sessions
            .keys()
            .map(|id| SessionInfo {
                session_id: id.clone(),
                cwd: String::new(),
                model: None,
                pid: 0,
                started_at: 0.0,
            })
            .collect();
    }
    vec![]
}

// ─── App Entrypoint ────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SessionManager::new())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_bootstrap,
            list_chats,
            read_chat,
            get_settings,
            save_settings,
            path_exists,
            list_dirs,
            manicode_path,
            check_freebuff,
            freebuff_login,
            start_session,
            write_session,
            kill_session,
            list_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
