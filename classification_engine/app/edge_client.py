"""
Edge device client that pushes classification results to cloud
"""
from __future__ import annotations

import grpc
import requests
from app.generated import result_receiver_pb2 as pb2
from app.generated import result_receiver_pb2_grpc as pb2_grpc
from app.jwt_grpc import metadata_kwargs


ACTIVE_SESSIONS_QUERY = """
query {
  activeSessions {
    sessionId
    projectId
    stableModel
    canaryModel
    stablePercent
    canaryPercent
    status
    createdAt
  }
}
"""

DEACTIVATE_ACTIVE_SESSION_MUTATION = """
mutation DeactivateActiveSession($projectId: String!) {
  deactivateActiveSession(projectId: $projectId)
}
"""


class EdgeResultClient:
    """Client that pushes classification results to cloud backend"""

    def __init__(
        self,
        cloud_host: str = "localhost",
        cloud_port: int = 9090,
        device_id: str = "edge-device-001",
        graphql_url: str = "http://localhost:8080/graphql",
    ):
        self.cloud_host = cloud_host
        self.cloud_port = cloud_port
        self.device_id = device_id
        self.graphql_url = graphql_url

        self.channel = grpc.insecure_channel(f"{cloud_host}:{cloud_port}")
        self.stub = pb2_grpc.ResultReceiverServiceStub(self.channel)

        print(f"[Edge Client] Connected to cloud at {cloud_host}:{cloud_port}")
        print(f"[Edge Client] GraphQL endpoint: {graphql_url}")

    def submit_result(
        self,
        project_id: str,
        image_name: str,
        label: str,
        confidence: float,
        model: str,
        class_id: int,
        latency: float,
        image_url: str,
        power_usage: float,
        co2_emissions: float,
    ) -> bool:
        """Push classification result to cloud"""
        try:
            result = pb2.ClassificationResult(
                ID=self.device_id,
                image_name=image_name,
                predicted_label=label,
                confidence=confidence,
                model=model,
                classID=class_id,
                latency=latency,
                image_url=image_url,
                power_usage=power_usage,
                co2_emissions=co2_emissions,
                project_id=project_id,
            )

            ack = self.stub.SubmitResult(result, **metadata_kwargs())

            if ack.received:
                print(
                    f"[Edge Client] Result submitted for project={project_id}: "
                    f"{label} ({confidence:.2%})"
                )
                return True

            print(f"[Edge Client] Failed: {ack.message}")
            return False

        except grpc.RpcError as e:
            print(f"[Edge Client] RPC failed: {e.code()}: {e.details()}")
            return False

    def sync_available_models(self, model_names: list[str]) -> bool:
        """Push available model names to cloud"""
        try:
            request = pb2.AvailableModelsSyncRequest(
                device_id=self.device_id,
                models=[pb2.AvailableModel(name=name) for name in model_names],
            )

            ack = self.stub.SyncAvailableModels(request)

            if ack.received:
                print(f"[Edge Client] Models synced: {model_names}")
                return True

            print(f"[Edge Client] Failed to sync models: {ack.message}")
            return False

        except grpc.RpcError as e:
            print(f"[Edge Client] RPC failed: {e.code()}: {e.details()}")
            return False

    def fetch_active_sessions(self) -> list[dict]:
        """Fetch all active sessions from backend GraphQL"""
        try:
            response = requests.post(
                self.graphql_url,
                json={"query": ACTIVE_SESSIONS_QUERY},
                timeout=10,
            )
            response.raise_for_status()

            payload = response.json()

            if payload.get("errors"):
                print(f"[Edge Client] GraphQL errors: {payload['errors']}")
                return []

            sessions = payload.get("data", {}).get("activeSessions") or []

            if not sessions:
                print("[Edge Client] No active sessions found")
                return []

            print(f"[Edge Client] Fetched {len(sessions)} active session(s)")
            for session in sessions:
                stable_model = session.get("stableModel") or "None"
                canary_model = session.get("canaryModel") or "None"
                stable_percent = session.get("stablePercent", 0)
                canary_percent = session.get("canaryPercent", 0)
                created_at = session.get("createdAt", "unknown")

                print(
                    "[Edge Client] Active session: "
                    f"project={session.get('projectId', 'unknown')}, "
                    f"stable={stable_model} ({stable_percent}%), "
                    f"canary={canary_model} ({canary_percent}%), "
                    f"createdAt={created_at}"
                )

            return sessions

        except requests.RequestException as e:
            print(f"[Edge Client] Failed to fetch active sessions: {e}")
            return []

    def deactivate_active_session(self, project_id: str) -> bool:
        """Deactivate the active session for a project via backend GraphQL"""
        try:
            response = requests.post(
                self.graphql_url,
                json={
                    "query": DEACTIVATE_ACTIVE_SESSION_MUTATION,
                    "variables": {"projectId": project_id},
                },
                timeout=10,
            )
            response.raise_for_status()

            payload = response.json()

            if payload.get("errors"):
                print(f"[Edge Client] GraphQL errors: {payload['errors']}")
                return False

            success = payload.get("data", {}).get("deactivateActiveSession", False)

            if success:
                print(f"[Edge Client] Active session deactivated for project={project_id}")
            else:
                print(f"[Edge Client] No active session found to deactivate for project={project_id}")

            return bool(success)

        except requests.RequestException as e:
            print(f"[Edge Client] Failed to deactivate active session: {e}")
            return False

    def close(self):
        """Close connection to cloud"""
        if self.channel:
            self.channel.close()