use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("こんにちは, {}! Tauriのバックエンドからのメッセージです。", name)
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SavedApp {
    name: String,
    package_family_name: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct AppData {
    selected_apps: Vec<SavedApp>,
}

fn get_data_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    Ok(app_data_dir.join("selected_apps.json"))
}

#[tauri::command]
fn save_selected_apps(
    app_handle: tauri::AppHandle,
    apps: Vec<SavedApp>,
) -> Result<(), String> {
    let path = get_data_file_path(&app_handle)?;
    let data = AppData { selected_apps: apps };
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_selected_apps(app_handle: tauri::AppHandle) -> Result<Vec<SavedApp>, String> {
    let path = get_data_file_path(&app_handle)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let json = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: AppData = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse saved data: {}", e))?;
    Ok(data.selected_apps)
}

#[tauri::command]
fn list_uwp_apps() -> Result<String, String> {
    let output = Command::new("powershell")
        .arg("-Command")
        .arg("Get-AppxPackage | Select-Object Name, PackageFamilyName | Format-List")
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let stdout = String::from_utf8(output.stdout)
            .map_err(|e| format!("UTF-8 decode error: {}", e))?;
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(stderr.to_string())
    }}

#[tauri::command]
fn launch_uwp_app(app_id: &str) -> Result<(), String> {
    // Validate app_id to only allow characters expected in a UWP app identifier
    // (PackageFamilyName format: alphanumeric, dots, underscores, hyphens, plus '!' for the entry point)
    if app_id.is_empty()
        || !app_id
            .chars()
            .all(|c| c.is_alphanumeric() || "._-!".contains(c))
    {
        return Err("Invalid app_id format".to_string());
    }
    let shell_path = format!("shell:AppsFolder\\{}", app_id);
    let output = Command::new("powershell")
        .arg("-Command")
        .arg(format!("Start-Process explorer.exe '{}'", shell_path))
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(stderr.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            list_uwp_apps,
            launch_uwp_app,
            save_selected_apps,
            load_selected_apps
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
