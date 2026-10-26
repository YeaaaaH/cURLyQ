use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpResponse {
    status: u16,
    // Tuples, not a HashMap, so repeated headers (Set-Cookie) survive.
    headers: Vec<(String, String)>,
    body: String,
    time_ms: u128,
    // Decoded body size; reqwest has already undone any Content-Encoding.
    size_bytes: usize,
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
    // serde(default) on fields added later, so older files still load.
    #[serde(default)]
    pre_request_script: String,
    #[serde(default)]
    post_response_script: String,
    #[serde(default = "default_script_tab")]
    active_script_tab: String,
    #[serde(default)]
    source_request_id: Option<String>,
    #[serde(default)]
    source_collection_id: Option<String>,
}

fn default_script_tab() -> String {
    "pre-request".to_string()
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PersistedTabsFile {
    active_tab_id: Option<String>,
    tabs: Vec<PersistedTab>,
}

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
        // Explicit rename: `rename_all` on the enum only renames the `type` tag, and a
        // snake_case field silently resets to empty on the camelCase frontend.
        #[serde(default, rename = "preRequestScript")]
        pre_request_script: String,
        #[serde(default, rename = "postResponseScript")]
        post_response_script: String,
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
    client: tauri::State<'_, reqwest::Client>,
    method: String,
    url: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
) -> Result<HttpResponse, String> {
    let method = method
        .parse::<reqwest::Method>()
        .map_err(|e| e.to_string())?;

    let mut request = client.request(method, &url);
    for (name, value) in headers {
        request = request.header(name, value);
    }
    if let Some(body) = body {
        request = request.body(body);
    }
    // Classify via reqwest rather than message text, which differs per OS.
    let start = std::time::Instant::now();
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
        .collect::<Vec<_>>();
    let body = response.text().await.map_err(|e| e.to_string())?;
    // Measured after the body is read: for a chunked body, send() returns at headers.
    let time_ms = start.elapsed().as_millis();
    let size_bytes = body.len();

    Ok(HttpResponse {
        status,
        headers,
        body,
        time_ms,
        size_bytes,
    })
}

fn data_file_path(app: &tauri::AppHandle, filename: &str) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(filename))
}

fn save_json<T: Serialize>(app: &tauri::AppHandle, filename: &str, data: &T) -> Result<(), String> {
    let path = data_file_path(app, filename)?;
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

// A missing file (first run) loads as empty, not an error.
fn load_json<T: DeserializeOwned + Default>(
    app: &tauri::AppHandle,
    filename: &str,
) -> Result<T, String> {
    let path = data_file_path(app, filename)?;
    if !path.exists() {
        return Ok(T::default());
    }
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_tabs(
    app: tauri::AppHandle,
    active_tab_id: Option<String>,
    tabs: Vec<PersistedTab>,
) -> Result<(), String> {
    save_json(
        &app,
        "tabs.json",
        &PersistedTabsFile {
            active_tab_id,
            tabs,
        },
    )
}

#[tauri::command]
fn load_tabs(app: tauri::AppHandle) -> Result<PersistedTabsFile, String> {
    load_json(&app, "tabs.json")
}

#[tauri::command]
fn save_environments(app: tauri::AppHandle, environments: Vec<Environment>) -> Result<(), String> {
    save_json(&app, "environments.json", &environments)
}

#[tauri::command]
fn load_environments(app: tauri::AppHandle) -> Result<Vec<Environment>, String> {
    load_json(&app, "environments.json")
}

#[cfg(test)]
mod collection_node_tests {
    use super::*;

    // The serialized shape is the IPC contract with the TS types; nothing else checks it.
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
                pre_request_script: "console.log('pre')".into(),
                post_response_script: "console.log('post')".into(),
            }],
        };

        let json = serde_json::to_value(&folder).unwrap();
        assert_eq!(json["type"], "folder");
        assert_eq!(json["items"][0]["type"], "request");
        assert_eq!(json["items"][0]["method"], "GET");
        assert_eq!(json["items"][0]["preRequestScript"], "console.log('pre')");
        assert_eq!(
            json["items"][0]["postResponseScript"],
            "console.log('post')"
        );
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

#[tauri::command]
fn save_collections(app: tauri::AppHandle, collections: Vec<Collection>) -> Result<(), String> {
    save_json(&app, "collections.json", &collections)
}

#[tauri::command]
fn load_collections(app: tauri::AppHandle) -> Result<Vec<Collection>, String> {
    load_json(&app, "collections.json")
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // One shared client keeps connection pooling and TLS sessions across sends.
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .expect("failed to build the shared HTTP client");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(http_client)
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
