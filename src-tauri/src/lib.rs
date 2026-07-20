use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize)]
struct HttpResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: String,
}

#[tauri::command]
async fn send_request(method: String, url: String) -> Result<HttpResponse, String> {
    let method = method.parse::<reqwest::Method>().map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();
    let response = client
        .request(method, &url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![send_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
