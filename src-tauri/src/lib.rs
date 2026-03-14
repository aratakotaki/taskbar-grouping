use std::process::Command;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("こんにちは, {}! Tauriのバックエンドからのメッセージです。", name)
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
        .invoke_handler(tauri::generate_handler![greet, list_uwp_apps, launch_uwp_app])
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
