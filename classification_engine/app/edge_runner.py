"""
Edge device runner - classifies images and pushes results to cloud
"""
from __future__ import annotations

import os
import signal
import sys
from pathlib import Path

from PIL import Image

from app.classifier import ACCEPTED_IMAGE_TYPES
from app.classifier import ImageClassifierEngine
from app.edge_client import EdgeResultClient
from app.model_registry import build_session_models


def choose_active_session(cloud_client: EdgeResultClient) -> dict:
    sessions = cloud_client.fetch_active_sessions()

    if not sessions:
        raise RuntimeError("No active sessions found")

    sorted_sessions = sorted(
        sessions,
        key=lambda session: session.get("createdAt") or "",
    )

    selected = sorted_sessions[0]

    print(
        "[Edge Device] Selected oldest active session: "
        f"project={selected.get('projectId')}, "
        f"session={selected.get('sessionId')}, "
        f"createdAt={selected.get('createdAt')}"
    )

    return selected


def load_classifier_from_session(session: dict) -> tuple[ImageClassifierEngine, str]:
    project_id = session.get("projectId")
    if not project_id:
        raise RuntimeError("Active session is missing projectId")

    stable_model = session.get("stableModel")
    canary_model = session.get("canaryModel")
    stable_percent = int(session.get("stablePercent", 0))
    canary_percent = int(session.get("canaryPercent", 0))

    models = build_session_models(
        stable_model_name=stable_model,
        canary_model_name=canary_model,
        stable_percent=stable_percent,
        canary_percent=canary_percent,
    )

    stable_display = stable_model if stable_model else "None"
    canary_display = canary_model if canary_model else "None"

    print("[Edge Device] Active session loaded")
    print(f"[Edge Device] Project={project_id}")
    print(f"[Edge Device] Stable={stable_display} ({stable_percent}%)")
    print(f"[Edge Device] Canary={canary_display} ({canary_percent}%)")
    print(
        "[Edge Device] Loaded models: "
        + ", ".join(model.model_name for model in models)
    )

    return ImageClassifierEngine(models=models), project_id


def process_image(
    image_path: Path,
    classifier: ImageClassifierEngine,
    cloud_client: EdgeResultClient,
    project_id: str,
) -> None:
    """Process a single image and push to cloud."""
    print(f"[Edge Device] Processing: {image_path.name}")

    image = Image.open(image_path)
    result = classifier.classify_image(image)

    print(f"  → {result.label:30s} ({result.confidence:.2%}) via {result.model}")

    success = cloud_client.submit_result(
        project_id=project_id,
        image_name=image_path.name,
        label=result.label,
        confidence=result.confidence,
        model=result.model,
        class_id=result.class_id,
        latency=result.latency,
        image_url=result.image_url,
        power_usage=result.power_usage,
        co2_emissions=result.co2_emissions,
    )

    if not success:
        print("[Edge Device] Failed to push result to cloud")


def main() -> None:
    print("[Edge Device] Connecting to cloud...")

    cloud_client = EdgeResultClient(
        cloud_host=os.environ.get("CLOUD_HOST", "localhost"),
        cloud_port=int(os.environ.get("CLOUD_PORT", 9090)),
        device_id=os.environ.get("DEVICE_ID", "edge-device-001"),
        graphql_url=os.environ.get("GRAPHQL_URL", "http://localhost:8080/graphql"),
    )

    project_id: str | None = None

    def handle_shutdown(signum, frame) -> None:
        print(f"\n[Edge Device] Received shutdown signal: {signum}")
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    try:
        print("[Edge Device] Discovering active sessions...")
        session = choose_active_session(cloud_client)

        classifier, project_id = load_classifier_from_session(session)

        if len(sys.argv) < 2:
            print("Usage:")
            print("  Single image: python -m app.edge_runner <image_path>")
            print("  Folder:       python -m app.edge_runner --folder <folder_path>")
            sys.exit(1)

        if sys.argv[1] == "--folder":
            if len(sys.argv) < 3:
                print("Error: Please provide folder path")
                sys.exit(1)

            folder_path = Path(sys.argv[2])
            if not folder_path.is_dir():
                print(f"Error: Not a directory: {folder_path}")
                sys.exit(1)

            image_files = [
                f for f in folder_path.iterdir()
                if f.suffix.lower() in ACCEPTED_IMAGE_TYPES
            ]

            if not image_files:
                print(f"No images found in {folder_path}")
                sys.exit(1)

            print(f"\nFound {len(image_files)} images\n")

            success_count = 0
            for image_file in sorted(image_files):
                process_image(image_file, classifier, cloud_client, project_id)
                success_count += 1

            print(f"\nProcessed {success_count}/{len(image_files)} images")

        else:
            image_path = Path(sys.argv[1])
            if not image_path.exists():
                print(f"Error: Image not found: {image_path}")
                sys.exit(1)

            process_image(image_path, classifier, cloud_client, project_id)

    except KeyboardInterrupt:
        print("\n[Edge Device] Interrupted by user")

    finally:
        if project_id:
            print(f"[Edge Device] Deactivating active session for project={project_id}...")
            cloud_client.deactivate_active_session(project_id)
        else:
            print("[Edge Device] No project selected, skipping session deactivation")

        cloud_client.close()


if __name__ == "__main__":
    main()