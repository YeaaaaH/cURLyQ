use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::Manager;

#[derive(Serialize)]
struct HttpResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct KeyValuePair {
    id: String,
    key: String,
    value: String,
    enabled: bool,
}

#[derive(Serialize, Deserialize, Clone)]
struct Environment {
    id: String,
    name: String,
    variables: Vec<KeyValuePair>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PersistedTab {
    id: String,
    name: String,
    method: String,
    url: String,
    params: Vec<KeyValuePair>,
    headers: Vec<KeyValuePair>,
    body: String,
    active_sub_tab: String,
    // Absent in tabs.json files saved before Collections existed —
    // `#[serde(default)]` reads those as None instead of failing to parse.
    #[serde(default)]
    source_request_id: Option<String>,
    #[serde(default)]
    source_collection_id: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedTabsFile {
    active_tab_id: Option<String>,
    tabs: Vec<PersistedTab>,
}

// Mirrors the frontend's CollectionNode discriminated union: `type` tags which
// variant a node is, so a folder can contain more folders or requests nested
// arbitrarily deep.
#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
enum CollectionNode {
    Folder {
        id: String,
        name: String,
        items: Vec<CollectionNode>,
    },
    Request {
        id: String,
        name: String,
        method: String,
        url: String,
        params: Vec<KeyValuePair>,
        headers: Vec<KeyValuePair>,
        body: String,
    },
}

#[derive(Serialize, Deserialize, Clone)]
struct Collection {
    id: String,
    name: String,
    items: Vec<CollectionNode>,
}

#[tauri::command]
async fn send_request(
    method: String,
    url: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
) -> Result<HttpResponse, String> {
    let method = method.parse::<reqwest::Method>().map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();
    let mut request = client.request(method, &url);
    for (name, value) in headers {
        request = request.header(name, value);
    }
    if let Some(body) = body {
        request = request.body(body);
    }
    // reqwest's own error classification (is_connect/is_timeout) is far more
    // reliable than pattern-matching the message text, which varies by OS
    // (e.g. "Connection refused (os error 10061)" on Windows vs. "(os error
    // 111)" on Linux). The technical detail stays appended for debugging —
    // just with a plain-language headline in front of it.
    let response = request.send().await.map_err(|e| {
        if e.is_connect() {
            format!("Couldn't connect to the server — it may not be running, or the address/port may be wrong.\n\n{e}")
        } else if e.is_timeout() {
            format!("The request timed out — the server didn't respond in time.\n\n{e}")
        } else {
            e.to_string()
        }
    })?;

    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .map(|(name, value)| {
            (
                name.to_string(),
                value.to_str().unwrap_or_default().to_string(),
            )
        })
        .collect::<HashMap<_, _>>();
    let body = response.text().await.map_err(|e| e.to_string())?;

    Ok(HttpResponse {
        status,
        headers,
        body,
    })
}

fn tabs_file_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("tabs.json"))
}

#[tauri::command]
fn save_tabs(
    app: tauri::AppHandle,
    active_tab_id: Option<String>,
    tabs: Vec<PersistedTab>,
) -> Result<(), String> {
    let path = tabs_file_path(&app)?;
    let file = PersistedTabsFile { active_tab_id, tabs };
    let json = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_tabs(app: tauri::AppHandle) -> Result<PersistedTabsFile, String> {
    let path = tabs_file_path(&app)?;
    if !path.exists() {
        return Ok(PersistedTabsFile { active_tab_id: None, tabs: vec![] });
    }
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

fn environments_file_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("environments.json"))
}

#[tauri::command]
fn save_environments(app: tauri::AppHandle, environments: Vec<Environment>) -> Result<(), String> {
    let path = environments_file_path(&app)?;
    let json = serde_json::to_string_pretty(&environments).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_environments(app: tauri::AppHandle) -> Result<Vec<Environment>, String> {
    let path = environments_file_path(&app)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[cfg(test)]
mod collection_node_tests {
    use super::*;

    // The frontend's CollectionNode is a discriminated union on a `type`
    // field with literal "folder"/"request" tags. This pins down that the
    // `#[serde(tag = "type", rename_all = "lowercase")]` attribute actually
    // produces that exact shape, since a mismatch here wouldn't be caught by
    // the compiler on either side of the IPC boundary.
    #[test]
    fn serializes_with_lowercase_type_tag() {
        let folder = CollectionNode::Folder {
            id: "f1".into(),
            name: "My Folder".into(),
            items: vec![CollectionNode::Request {
                id: "r1".into(),
                name: "Get users".into(),
                method: "GET".into(),
                url: "https://example.com".into(),
                params: vec![],
                headers: vec![],
                body: String::new(),
            }],
        };

        let json = serde_json::to_value(&folder).unwrap();
        assert_eq!(json["type"], "folder");
        assert_eq!(json["items"][0]["type"], "request");
        assert_eq!(json["items"][0]["method"], "GET");
    }

    #[test]
    fn round_trips_through_json() {
        let original = Collection {
            id: "c1".into(),
            name: "My Collection".into(),
            items: vec![CollectionNode::Folder {
                id: "f1".into(),
                name: "Nested".into(),
                items: vec![],
            }],
        };

        let json = serde_json::to_string(&original).unwrap();
        let parsed: Collection = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, original.id);
        assert_eq!(parsed.items.len(), 1);
    }
}

fn collections_file_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("collections.json"))
}

#[tauri::command]
fn save_collections(app: tauri::AppHandle, collections: Vec<Collection>) -> Result<(), String> {
    let path = collections_file_path(&app)?;
    let json = serde_json::to_string_pretty(&collections).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_collections(app: tauri::AppHandle) -> Result<Vec<Collection>, String> {
    let path = collections_file_path(&app)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

// Reads an arbitrary file the user picked via the native open dialog (import
// flow) — unlike the app-data-dir helpers above, `path` isn't ours to choose,
// it comes straight from the OS file picker the user just interacted with.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

// Writes to a path the user chose via the native save dialog (export flow).
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            send_request,
            save_tabs,
            load_tabs,
            save_environments,
            load_environments,
            save_collections,
            load_collections,
            read_text_file,
            write_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
