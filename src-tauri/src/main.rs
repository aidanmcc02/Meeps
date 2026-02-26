#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use named_lock::NamedLock;
use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
};

const RUN_KEY_NAME: &str = "Meeps";
const SINGLE_INSTANCE_LOCK_NAME: &str = "meeps_single_instance";

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

/// Returns the title of the currently focused window. Uses only GetForegroundWindow + GetWindowTextW
/// (no process memory access, no injection) so it is safe with respect to game anticheats.
#[tauri::command]
#[cfg(target_os = "windows")]
fn get_foreground_window_title() -> Result<Option<String>, String> {
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return Ok(None);
        }
        let mut buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut buf);
        if len <= 0 {
            return Ok(None);
        }
        let s = String::from_utf16_lossy(&buf[..len as usize]);
        let s = s.trim();
        if s.is_empty() {
            return Ok(None);
        }
        Ok(Some(s.to_string()))
    }
}

#[tauri::command]
#[cfg(not(target_os = "windows"))]
fn get_foreground_window_title() -> Result<Option<String>, String> {
    Ok(None)
}

/// Returns the number of commits reachable from main/master/HEAD in the given repo (or current dir).
/// Used by the Board Stats tab when running in Tauri so git runs where the app was started.
#[tauri::command]
fn get_git_commit_count(repo_path: Option<String>) -> Result<u32, String> {
    let cwd = match repo_path {
        Some(p) if !p.trim().is_empty() => std::path::PathBuf::from(p.trim()),
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };
    if !cwd.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }
    const BRANCHES: &[&str] = &["main", "master", "HEAD"];
    for branch in BRANCHES {
        let out = std::process::Command::new("git")
            .args(["rev-list", "--count", branch])
            .current_dir(&cwd)
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if let Ok(n) = s.parse::<u32>() {
                return Ok(n);
            }
        }
    }
    Err("Could not get commit count for main, master, or HEAD".to_string())
}

fn main() {
    let lock = NamedLock::create(SINGLE_INSTANCE_LOCK_NAME).expect("failed to create single-instance lock");
    let _instance_guard = match lock.try_lock() {
        Ok(guard) => guard,
        Err(_) => {
            eprintln!("Another instance of Meeps is already running.");
            std::process::exit(1);
        }
    };

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
        get_foreground_window_title,
        get_git_commit_count,
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

