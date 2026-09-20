"""Ladder of Why backend package.

Loads .env on import (without overriding variables already set in the real
environment), so `python -m backend.app` picks up an API key with no extra
dependency on python-dotenv.
"""

from __future__ import annotations

import os
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def load_env(path: Path = ENV_PATH) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        # Real environment variables win over the file.
        if key and key not in os.environ:
            os.environ[key] = value


load_env()
