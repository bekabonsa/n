#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import tempfile
import threading
import time
import traceback
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


ROOT = Path(tempfile.gettempdir()) / "nuvio-hls"
SESSIONS = {}
SESSION_LOCK = threading.Lock()
CONFIG = {
    "quality": "auto",
    "max_sessions": 3,
    "idle_ttl": 20 * 60,
    "playlist_timeout": 35,
    "proxy_timeout": 25,
    "proxy_retries": 3,
}
PIPELINE_VERSION = "video_copy_fmp4_audio_aac_v2"

QUALITY = {
    "auto": {},
    "1080p": {},
    "720p": {},
    "480p": {},
    "copy": {},
}


class Session:
    def __init__(self, key, out_dir, playlist, process, cmd, mode):
        self.key = key
        self.out_dir = out_dir
        self.playlist = playlist
        self.process = process
        self.cmd = cmd
        self.mode = mode
        self.created_at = time.time()
        self.last_access = time.time()

    def alive(self):
        return self.process and self.process.poll() is None

    def touch(self):
        self.last_access = time.time()

    def stop(self):
        if not self.alive():
            return
        try:
            self.process.terminate()
            self.process.wait(timeout=4)
        except Exception:
            try:
                self.process.kill()
            except Exception:
                pass


class Handler(SimpleHTTPRequestHandler):
    server_version = "NuvioTranscoder/2.0"

    def log_message(self, fmt, *args):
        print("%s - - [%s] %s" % (self.client_address[0], self.log_date_time_string(), fmt % args))

    def log_client_disconnect(self):
        print("%s - - [%s] Client closed request for %s" % (
            self.client_address[0],
            self.log_date_time_string(),
            self.path,
        ))

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Range, Origin, Accept, Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def translate_path(self, path):
        parsed = urlparse(path)
        parts = parsed.path.strip("/").split("/")
        query = parse_qs(parsed.query)

        if len(parts) >= 3 and parts[0] == "hlsv2":
            media_url = query.get("mediaURL", [""])[0]
            seek_seconds = parse_int(query.get("seek", ["0"])[0])
            session = session_key(parts[1], media_url, seek_seconds) if media_url else safe_name(parts[1])
            return str(ROOT / "hlsv2" / session / "/".join(parts[2:]))

        return str(ROOT / parsed.path.lstrip("/"))

    def send_json(self, payload, status=200):
        data = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_playlist(self, playlist):
        text = rewrite_playlist_segments(playlist)
        data = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)

        if parsed.path == "/health":
            self.send_json(build_health())
            return

        if parsed.path == "/shutdown":
            stop_all_sessions()
            self.send_json({"ok": True})
            return

        if parsed.path == "/proxy-json":
            target_url = query.get("url", [""])[0]
            if not target_url:
                self.send_json({"error": "Missing url"}, 400)
                return
            try:
                payload, status = fetch_json_proxy(target_url)
                self.send_json(payload, status)
            except Exception as error:
                traceback.print_exc()
                self.send_json({"error": str(error)}, 502)
            return

        if parsed.path.endswith("/video0.m3u8") and query.get("mediaURL"):
            try:
                session = parsed.path.strip("/").split("/")[1]
                media_url = query["mediaURL"][0]
                seek_seconds = parse_int(query.get("seek", ["0"])[0])
                quality = normalize_quality(query.get("quality", [CONFIG["quality"]])[0])
                playlist = ensure_hls(session, media_url, seek_seconds, quality)
                if not wait_for_playlist_ready(playlist, CONFIG["playlist_timeout"]):
                    self.send_error(503, "Playlist is not ready. ffmpeg may still be buffering or failed.")
                    return
                self.send_playlist(playlist)
                return
            except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
                self.log_client_disconnect()
                return
            except Exception as error:
                traceback.print_exc()
                self.send_error(500, str(error))
                return

        if parsed.path.startswith("/hlsv2/") and (
                parsed.path.endswith(".ts")
                or parsed.path.endswith(".m4s")
                or parsed.path.endswith(".mp4")):
            wait_for_file(Path(self.translate_path(self.path)), 6)

        try:
            return super().do_GET()
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            self.log_client_disconnect()
            return


def safe_name(value):
    return unquote(value).replace("/", "_").replace("\\", "_").replace(":", "_")


def parse_int(value):
    try:
        return max(0, int(float(value or 0)))
    except Exception:
        return 0


def normalize_quality(value):
    value = str(value or CONFIG["quality"]).lower()
    return value if value in QUALITY else CONFIG["quality"]


def require_tool(name):
    path = shutil.which(name)
    if not path:
        raise RuntimeError(f"{name} is required and was not found on PATH.")
    return path


def wait_for_file(path, timeout):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if path.exists() and path.stat().st_size > 0:
            return True
        time.sleep(0.25)
    return False


def wait_for_playlist_ready(playlist, timeout):
    deadline = time.time() + timeout

    while time.time() < deadline:
        ready, missing = playlist_is_ready(playlist)
        if ready:
            return True
        if missing:
            wait_for_file(missing, min(1, max(0, deadline - time.time())))
        else:
            time.sleep(0.25)

    return False


def playlist_is_ready(playlist):
    text = ""
    segment_name = ""
    init_name = ""

    if not playlist.exists() or playlist.stat().st_size <= 0:
        return False, playlist

    text = playlist.read_text(encoding="utf-8", errors="replace")
    for line in text.splitlines():
        stripped = line.strip()
        map_match = re.search(r'URI="([^"]+)"', stripped)
        if map_match and not init_name:
            init_name = map_match.group(1)
        if stripped and not stripped.startswith("#"):
            segment_name = stripped
            break

    if not segment_name:
        return False, playlist

    if init_name:
        init_path = playlist_local_path(playlist, init_name)
        if not init_path.exists() or init_path.stat().st_size <= 0:
            return False, init_path

    segment_path = playlist_local_path(playlist, segment_name)
    if not segment_path.exists() or segment_path.stat().st_size <= 0:
        return False, segment_path

    return True, None


def playlist_local_path(playlist, value):
    local_path = Path(value)

    if local_path.is_absolute():
        return local_path

    return playlist.parent / value


def playlist_served_name(value):
    return value.replace("\\", "/").rstrip("/").split("/")[-1]


def rewrite_playlist_segments(playlist):
    base_url = f"/hlsv2/{quote(playlist.parent.name, safe='')}/"
    lines = []

    def rewrite_uri(match):
        uri = match.group(1)
        if not uri or "://" in uri or uri.startswith("/"):
            return match.group(0)
        return 'URI="' + base_url + quote(playlist_served_name(uri), safe="/") + '"'

    for line in playlist.read_text(encoding="utf-8", errors="replace").splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            lines.append(re.sub(r'URI="([^"]+)"', rewrite_uri, line))
            continue
        if not stripped or "://" in stripped or stripped.startswith("/"):
            lines.append(line)
            continue
        lines.append(base_url + quote(playlist_served_name(stripped), safe="/"))

    return "\n".join(lines) + "\n"


def probe_video_codec(media_url):
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return ""

    cmd = [
        ffprobe,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name",
        "-of", "default=noprint_wrappers=1:nokey=1",
        media_url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
    except Exception:
        return ""

    if result.returncode != 0:
        return ""

    return (result.stdout or "").strip().splitlines()[0].lower() if result.stdout else ""


def build_video_args(video_codec):
    args = ["-c:v", "copy"]
    mode = "copy-video-fmp4-transcode-audio"

    if video_codec in ("hevc", "h265"):
        args += ["-tag:v", "hvc1"]
        mode += "-hvc1"

    return args, mode


def fetch_json_proxy(target_url):
    parsed = urlparse(target_url)
    last_error = None

    if parsed.scheme not in ("http", "https"):
        return {"error": "Only HTTP(S) URLs are supported"}, 400

    for attempt in range(CONFIG["proxy_retries"]):
        try:
            request = Request(target_url, headers={
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 NuvioTranscoder/2.0",
            })
            with urlopen(request, timeout=CONFIG["proxy_timeout"]) as response:
                text = response.read().decode("utf-8", errors="replace")
                return json.loads(text), response.status
        except HTTPError as error:
            last_error = error
            if error.code < 500 and error.code != 429:
                text = error.read().decode("utf-8", errors="replace")
                return safe_json_error(text, error.code), error.code
        except (URLError, TimeoutError) as error:
            last_error = error

        time.sleep(0.6 * (attempt + 1))

    return {"error": str(last_error or "Proxy request failed")}, 502


def safe_json_error(text, status):
    try:
        payload = json.loads(text)
        if isinstance(payload, dict):
            return payload
    except Exception:
        pass
    return {"error": text.strip() or f"HTTP {status}"}


def session_key(session, media_url, seek_seconds):
    digest = hashlib.sha1(media_url.encode("utf-8")).hexdigest()[:12]
    return f"{safe_name(session)}_{digest}_{PIPELINE_VERSION}_seek_{seek_seconds}"


def ensure_hls(session, media_url, seek_seconds=0, quality="auto"):
    ffmpeg = require_tool("ffmpeg")
    cleanup_sessions()

    key = session_key(session, media_url, seek_seconds)
    out_dir = ROOT / "hlsv2" / key
    playlist = out_dir / "video0.m3u8"
    out_dir.mkdir(parents=True, exist_ok=True)

    with SESSION_LOCK:
        existing = SESSIONS.get(key)
        if existing:
            existing.touch()
            if existing.alive() or playlist.exists():
                return playlist
            SESSIONS.pop(key, None)

    video_codec = probe_video_codec(media_url)
    video_args, mode = build_video_args(video_codec)
    segment = out_dir / "segment_%05d.m4s"
    init_segment = out_dir / "init.mp4"

    cmd = [
        ffmpeg,
        "-hide_banner",
        "-loglevel", "warning",
        "-nostdin",
        "-fflags", "+genpts",
        "-analyzeduration", "100M",
        "-probesize", "100M",
        "-reconnect", "1",
        "-reconnect_streamed", "1",
        "-reconnect_at_eof", "1",
        "-reconnect_on_network_error", "1",
        "-reconnect_on_http_error", "4xx,5xx",
        "-reconnect_delay_max", "5",
        "-reconnect_delay_total_max", "90",
        "-rw_timeout", "15000000",
        "-user_agent", "Mozilla/5.0 NuvioTranscoder/2.0",
    ]
    if seek_seconds > 0:
        cmd += ["-ss", str(seek_seconds)]
    cmd += [
        "-i", media_url,
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-map_metadata", "-1",
        "-sn",
        "-dn",
        *video_args,
        "-c:a", "aac",
        "-b:a", "192k",
        "-ac", "2",
        "-f", "hls",
        "-hls_time", "4",
        "-hls_list_size", "0",
        "-hls_playlist_type", "event",
        "-hls_segment_type", "fmp4",
        "-hls_fmp4_init_filename", str(init_segment),
        "-hls_flags", "independent_segments+temp_file",
        "-hls_segment_filename", str(segment),
        str(playlist),
    ]

    print(f"Starting ffmpeg session {key} ({mode}, seek={seek_seconds}s)")
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    session_obj = Session(key, out_dir, playlist, process, cmd, mode)

    with SESSION_LOCK:
        SESSIONS[key] = session_obj
        enforce_session_limit()

    threading.Thread(target=log_process_errors, args=(session_obj,), daemon=True).start()
    return playlist


def log_process_errors(session):
    if not session.process or not session.process.stderr:
        return

    for line in session.process.stderr:
        line = line.strip()
        if line:
            print(f"[ffmpeg:{session.key}] {line}")


def cleanup_sessions():
    now = time.time()
    with SESSION_LOCK:
        stale = [
            key for key, session in SESSIONS.items()
            if (not session.alive() and not session.playlist.exists())
            or (now - session.last_access > CONFIG["idle_ttl"])
        ]
        for key in stale:
            session = SESSIONS.pop(key, None)
            if session:
                session.stop()


def enforce_session_limit():
    if len(SESSIONS) <= CONFIG["max_sessions"]:
        return

    ordered = sorted(SESSIONS.values(), key=lambda item: item.last_access)
    for session in ordered[:max(0, len(SESSIONS) - CONFIG["max_sessions"])]:
        SESSIONS.pop(session.key, None)
        session.stop()


def stop_all_sessions():
    with SESSION_LOCK:
        sessions = list(SESSIONS.values())
        SESSIONS.clear()
    for session in sessions:
        session.stop()


def build_health():
    cleanup_sessions()
    with SESSION_LOCK:
        sessions = [
            {
                "key": session.key,
                "mode": session.mode,
                "alive": session.alive(),
                "ageSeconds": round(time.time() - session.created_at, 1),
                "idleSeconds": round(time.time() - session.last_access, 1),
                "playlist": str(session.playlist),
            }
            for session in SESSIONS.values()
        ]
    return {
        "ok": True,
        "root": str(ROOT),
        "ffmpeg": shutil.which("ffmpeg"),
        "ffprobe": shutil.which("ffprobe"),
        "sessions": sessions,
        "config": CONFIG,
    }


def handle_shutdown(signum, frame):
    stop_all_sessions()
    raise SystemExit(0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=17870)
    parser.add_argument("--quality", choices=sorted(QUALITY.keys()), default="auto")
    parser.add_argument("--max-sessions", type=int, default=3)
    args = parser.parse_args()

    CONFIG["quality"] = args.quality
    CONFIG["max_sessions"] = max(1, args.max_sessions)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    ROOT.mkdir(parents=True, exist_ok=True)
    os.chdir(ROOT)
    print(f"Nuvio transcoder listening on http://{args.host}:{args.port}")
    print(f"Mode=copy video/transcode audio maxSessions={CONFIG['max_sessions']}")
    print("Requires ffmpeg on PATH.")
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
