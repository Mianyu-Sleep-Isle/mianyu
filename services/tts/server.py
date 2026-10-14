"""CPU TTS stub. CosyVoice is imported only when the package is already installed."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def synthesize(text: str) -> bytes:
    try:
        import cosyvoice  # type: ignore
    except Exception:
        cosyvoice = None
    if cosyvoice is not None:
        raise RuntimeError("CosyVoice is installed but the local voice file is not wired yet")
    return silent_wav(max(1, len(text) // 8))


def silent_wav(seconds: int) -> bytes:
    sample_rate = 44100
    samples = sample_rate * seconds
    data_size = samples * 2
    header = b"RIFF" + (36 + data_size).to_bytes(4, "little") + b"WAVEfmt "
    header += (16).to_bytes(4, "little") + (1).to_bytes(2, "little") + (1).to_bytes(2, "little")
    header += sample_rate.to_bytes(4, "little") + (sample_rate * 2).to_bytes(4, "little")
    header += (2).to_bytes(2, "little") + (16).to_bytes(2, "little") + b"data" + data_size.to_bytes(4, "little")
    return header + (b"\x00" * data_size)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] != "/health":
            self.send_error(404)
            return
        body = b'{"status":"ok"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if self.path.split("?", 1)[0] != "/tts":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length) or b"{}")
        text = str(payload.get("text") or "")
        audio = synthesize(text)
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)

    def log_message(self, fmt: str, *args: object) -> None:
        return


def main() -> None:
    ThreadingHTTPServer(("127.0.0.1", 9880), Handler).serve_forever()


if __name__ == "__main__":
    main()
