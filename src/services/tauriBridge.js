import { invoke } from "@tauri-apps/api/tauri";

export async function invokeTauri(command, payload) {
  return invoke(command, payload);
}

