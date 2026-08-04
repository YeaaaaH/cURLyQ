use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpResponse {
    status: u16,
    // A tuple vec (not HashMap<String, String>) so repeated header names —
    // e.g. multiple Set-Cookie values — survive instead of the later one
    // silently overwriting the earlier ones.
    headers: Vec<(String, String)>,
    body: String,
    time_ms: u128,
    // Body size only (not a "wire size" including headers/status line) —
    // matches what `body` actually holds, since reqwest already decodes any
    // Content-Encoding before we see it.
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
    // Absent in tabs.json files saved before pre-request/post-response
    // scripts existed — defaulted the same way source_request_id below is,
    // for the same reason (older files shouldn't fail to parse).
    #[serde(default)]
    pre_request_script: String,
    #[serde(default)]
    post_response_script: String,
    #[serde(default = "default_script_tab")]
    active_script_tab: String,
    // Absent in tabs.json files saved before Collections existed —
    // `#[serde(default)]` reads those as None instead of failing to parse.
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
        // Absent in collections.json files saved before scripts existed —
        // defaulted for the same reason as PersistedTab's script fields above.
        // Explicit camelCase `rename` (not `rename_all` on the enum, which
        // only affects the `type` tag's variant names, not field names
        // within a variant) — without it, this silently round-trips as
        // `pre_request_script`/`post_response_script` over the IPC
        // boundary, which the frontend's camelCase `RequestNode` never
        // matches: every save quietly resets scripts to empty, and every
        // load leaves them `undefined`.
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
    // reqwest's own error classification (is_connect/is_timeout) is far more
    // reliable than pattern-matching the message text, which varies by OS
    // (e.g. "Connection refused (os error 10061)" on Windows vs. "(os error
    // 111)" on Linux). The technical detail stays appended for debugging —
    // just with a plain-language headline in front of it.
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
    // Measured through body-read completion, not just the initial response —
    // for a streamed/chunked body, `.send()` alone returns once headers
    // arrive, well before the transfer (and the time a user actually waits)
    // is done.
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

// Resolves a filename to a path inside the app's data directory, creating
// that directory if it doesn't exist yet — shared by every persisted-JSON
// file below (tabs/environments/collections), which otherwise differed only
// by filename and the type being (de)serialized.
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

// Returns `T::default()` (an empty Vec, or an empty PersistedTabsFile) when
// the file hasn't been written yet, rather than treating a first run as an
// error.
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
                pre_request_script: "console.log('pre')".into(),
                post_response_script: "console.log('post')".into(),
            }],
        };

        let json = serde_json::to_value(&folder).unwrap();
        assert_eq!(json["type"], "folder");
        assert_eq!(json["items"][0]["type"], "request");
        assert_eq!(json["items"][0]["method"], "GET");
        // Pins the camelCase field names the frontend's `RequestNode` type
        // actually expects — this exact mismatch (fields round-tripping as
        // `pre_request_script`/`post_response_script` instead) silently
        // dropped every saved script and left every loaded one `undefined`.
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
    // Built once and reused across every `send_request` call via Tauri's
    // managed state, instead of a fresh `reqwest::Client` per request — a new
    // client would throw away connection pooling and redo TLS setup every
    // single send. The 30s timeout also gives a hung server a firm cutoff
    // instead of leaving the request pending indefinitely.
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
