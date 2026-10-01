"""
Almacén simple en JSON para chats en texto plano.
Reemplaza a las tablas `conversations` / `messages` de la base para esta
versión simplificada (sin cifrado E2E).
"""
import json
import threading
from pathlib import Path
from typing import Any, Dict

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_DATA_FILE = _DATA_DIR / "chats.json"

_lock = threading.Lock()

_EMPTY: Dict[str, Any] = {"conversations": [], "messages": []}


def _ensure_file() -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not _DATA_FILE.exists():
        _DATA_FILE.write_text(json.dumps(_EMPTY, indent=2), encoding="utf-8")


def load() -> Dict[str, Any]:
    """Lee el JSON completo. Si no existe o está corrupto, lo reinicializa."""
    with _lock:
        _ensure_file()
        try:
            with open(_DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            data = json.loads(json.dumps(_EMPTY))
        data.setdefault("conversations", [])
        data.setdefault("messages", [])
        return data


def save(data: Dict[str, Any]) -> None:
    """Escribe el JSON completo (atómico vía archivo temporal)."""
    with _lock:
        _ensure_file()
        tmp_file = _DATA_FILE.with_suffix(".tmp")
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
        tmp_file.replace(_DATA_FILE)


def next_conversation_id(data: Dict[str, Any]) -> int:
    ids = [c["id"] for c in data["conversations"]]
    return (max(ids) + 1) if ids else 1


def next_message_id(data: Dict[str, Any]) -> int:
    ids = [m["id"] for m in data["messages"]]
    return (max(ids) + 1) if ids else 1
