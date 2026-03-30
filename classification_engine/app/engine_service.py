from __future__ import annotations

import os
import time

from app.edge_client import EdgeResultClient
from app.model_registry import get_model_names


def main():
    print("[Edge Engine] Syncing models...")

    client = EdgeResultClient(
        cloud_host=os.environ.get("CLOUD_HOST", "localhost"),
        cloud_port=int(os.environ.get("CLOUD_PORT", 9090)),
        device_id=os.environ.get("DEVICE_ID", "edge-device-001"),
    )

    client.sync_available_models(get_model_names())

    # keep container alive
    while True:
        time.sleep(60)


if __name__ == "__main__":
    main()