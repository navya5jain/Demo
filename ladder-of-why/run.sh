#!/usr/bin/env bash
# Ladder of Why - install deps (once) and start the server.
set -e
cd "$(dirname "$0")"
python3 -m pip install -q -r requirements.txt
exec python3 -m backend.app
