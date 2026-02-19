#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
};

const RUN_KEY_NAME: &str = "Meeps";

#[tauri::command]
#[cfg(target_os = "windows")]
fn is_launch_at_startup_enabled() -> Result<bool, String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let exe = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    let key = hkcu
        .open_subkey_with_flags(path, winreg::enums::KEY_READ)
        .map_err(|e: std::io::Error| e.to_string())?;
    let val: String = key.get_value(RUN_KEY_NAME).unwrap_or_default();
    Ok(val == exe)
}

#[tauri::command]
#[cfg(target_os = "windows")]
fn set_launch_at_startup(enabled: bool) -> Result<(), String> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
    use winreg::RegKey;

    let exe = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    let key = hkcu
        .open_subkey_with_flags(path, KEY_READ | KEY_WRITE)
        .map_err(|e: std::io::Error| e.to_string())?;
    if enabled {
        key.set_value(RUN_KEY_NAME, &exe)
            .map_err(|e: std::io::Error| e.to_string())?;
    } else {
        let _ = key.delete_value(RUN_KEY_NAME);
    }
    Ok(())
}

#[tauri::command]
#[cfg(not(target_os = "windows"))]
fn is_launch_at_startup_enabled() -> Result<bool, String> {
    Ok(false)
}

#[tauri::command]
#[cfg(not(target_os = "windows"))]
fn set_launch_at_startup(_enabled: bool) -> Result<(), String> {
    Ok(())
}

fn main() {
    let show_item = CustomMenuItem::new("show".to_string(), "Show Meeps");
    let quit_item = CustomMenuItem::new("quit".to_string(), "Quit");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show_item)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit_item);
    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| {
            match event {
                SystemTrayEvent::MenuItemClick { id, .. } => {
                    match id.as_str() {
                        "show" => {
                            if let Some(window) = app.get_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                }
                SystemTrayEvent::LeftClick { .. } => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
        is_launch_at_startup_enabled,
        set_launch_at_startup,
    ])
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                let _ = event.window().hide();
                api.prevent_close();
            }
        })
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running Meeps Tauri application");
}

