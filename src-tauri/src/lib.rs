use serde::Deserialize;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewWindow};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Deserialize)]
struct HealthResponse {
    application: String,
    status: String,
}

enum PortStatus {
    Healthy,
    OccupiedOther,
    Closed,
}

fn run_cmd(mut cmd: Command) -> Result<std::process::Output, String> {
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.output().map_err(|e| e.to_string())
}

fn parse_health_response(raw: &[u8]) -> PortStatus {
    let text = String::from_utf8_lossy(raw);
    let status_line = text.lines().next().unwrap_or("");
    if !status_line.contains(" 200 ")
        && !status_line.ends_with(" 200")
        && !status_line.contains(" 200 OK")
    {
        return PortStatus::OccupiedOther;
    }

    let body = match text.split("\r\n\r\n").nth(1) {
        Some(b) => b,
        None => return PortStatus::OccupiedOther,
    };

    match serde_json::from_str::<HealthResponse>(body.trim()) {
        Ok(res) if res.application == "JohnBot" && res.status == "ready" => PortStatus::Healthy,
        _ => PortStatus::OccupiedOther,
    }
}

fn check_health() -> PortStatus {
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    let timeout = Duration::from_millis(800);

    let mut stream = match TcpStream::connect_timeout(&addr, timeout) {
        Ok(s) => s,
        Err(_) => return PortStatus::Closed,
    };

    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));

    let req = b"GET /api/health HTTP/1.0\r\nHost: 127.0.0.1:3000\r\nConnection: close\r\n\r\n";
    if stream.write_all(req).is_err() {
        return PortStatus::OccupiedOther;
    }

    let mut buf = Vec::new();
    let mut take = (&mut stream).take(65536);
    if take.read_to_end(&mut buf).is_err() {
        return PortStatus::OccupiedOther;
    }

    parse_health_response(&buf)
}

#[tauri::command]
async fn start_local_backend(window: WebviewWindow, app: AppHandle) -> Result<String, String> {
    let origin = window.url().map_err(|e| e.to_string())?;
    let scheme = origin.scheme();
    let host = origin.host_str().unwrap_or("");

    let is_bootstrap = (scheme == "tauri" && (host == "localhost" || host.is_empty()))
        || (scheme == "http" && host == "tauri.localhost")
        || (scheme == "https" && host == "tauri.localhost");

    if !is_bootstrap {
        return Err("Origem nao autorizada para chamar o backend nativo.".into());
    }

    tauri::async_runtime::spawn_blocking(move || {
        match check_health() {
            PortStatus::Healthy => return Ok("http://localhost:3000".into()),
            PortStatus::OccupiedOther => {
                return Err(
                    "Porta 3000 ocupada por outro servico. Libere a porta antes de iniciar.".into(),
                );
            }
            PortStatus::Closed => {}
        }

        let mut info_cmd = Command::new("docker");
        info_cmd.arg("info");
        let info_res = run_cmd(info_cmd);
        if info_res.is_err() || !info_res.unwrap().status.success() {
            return Err(
                "Docker Desktop nao detectado ou parado. Abra o Docker e compile as imagens."
                    .into(),
            );
        }

        let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
        let mut compose_path = resource_dir.clone();
        compose_path.push("runtime");
        compose_path.push("compose.yaml");

        if !compose_path.exists() {
            let mut dev_path = PathBuf::from("runtime");
            dev_path.push("compose.yaml");
            if dev_path.exists() {
                compose_path = dev_path;
            } else {
                return Err("Arquivo compose.yaml nao encontrado no bundle ou projeto.".into());
            }
        }

        let mut up_cmd = Command::new("docker");
        up_cmd
            .arg("compose")
            .arg("-p")
            .arg("johnbot")
            .arg("-f")
            .arg(&compose_path)
            .arg("up")
            .arg("-d")
            .arg("--wait")
            .arg("--wait-timeout")
            .arg("120");

        let up_output = run_cmd(up_cmd)?;
        if !up_output.status.success() {
            let err_text = String::from_utf8_lossy(&up_output.stderr);
            return Err(format!(
                "Falha ao subir containers docker: {}",
                err_text.trim()
            ));
        }

        match check_health() {
            PortStatus::Healthy => Ok("http://localhost:3000".into()),
            PortStatus::OccupiedOther => {
                Err("Aplicativo iniciado em conflito de porta 3000.".into())
            }
            PortStatus::Closed => {
                Err("Containers iniciados mas JohnBot nao respondeu na rota /api/health.".into())
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![start_local_backend])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_healthy_response() {
        let res = b"HTTP/1.0 200 OK\r\nConnection: close\r\n\r\n{\"application\":\"JohnBot\",\"status\":\"ready\"}";
        assert!(matches!(parse_health_response(res), PortStatus::Healthy));
    }

    #[test]
    fn test_parse_wrong_service() {
        let res = b"HTTP/1.0 200 OK\r\nConnection: close\r\n\r\n{\"application\":\"OtherApp\",\"status\":\"ready\"}";
        assert!(matches!(
            parse_health_response(res),
            PortStatus::OccupiedOther
        ));
    }

    #[test]
    fn test_parse_non_200() {
        let res = b"HTTP/1.0 500 Internal Server Error\r\nConnection: close\r\n\r\n{\"application\":\"JohnBot\",\"status\":\"ready\"}";
        assert!(matches!(
            parse_health_response(res),
            PortStatus::OccupiedOther
        ));
    }
}
