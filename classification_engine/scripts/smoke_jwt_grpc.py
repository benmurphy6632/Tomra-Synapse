#!/usr/bin/env python3
"""
Minimal gRPC + JWT smoke test (no PyTorch).
Run from classification_engine: python3 scripts/smoke_jwt_grpc.py
Requires: Spring Boot on localhost:9090 with edge.grpc.jwt.enabled=true and matching EDGE_GRPC_JWT_SECRET.
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
# Generated stubs import result_receiver_pb2 as a top-level module
sys.path.insert(0, os.path.join(ROOT, "app", "generated"))

import grpc

from app.generated import result_receiver_pb2 as pb2
from app.generated import result_receiver_pb2_grpc as pb2_grpc
from app.jwt_grpc import metadata_kwargs


def main() -> None:
    host = os.environ.get("EDGE_GRPC_HOST", "localhost")
    port = os.environ.get("EDGE_GRPC_PORT", "9090")
    addr = f"{host}:{port}"

    print(f"[smoke_jwt_grpc] Connecting to {addr} with JWT metadata...")
    channel = grpc.insecure_channel(addr)
    stub = pb2_grpc.ResultReceiverServiceStub(channel)

    req = pb2.ClassificationResult(
        ID="jwt-smoke-test",
        image_name="smoke.png",
        image_data=b"",
        predicted_label="test",
        confidence=0.99,
        model="smoke-model",
        classID=1,
        latency=0.01,
        image_url="",
        power_usage=0.0,
        co2_emissions=0.0,
    )

    try:
        resp = stub.SubmitResult(req, **metadata_kwargs())
        print(f"[smoke_jwt_grpc] OK — received={resp.received} message={resp.message!r}")
    except grpc.RpcError as e:
        print(f"[smoke_jwt_grpc] FAILED: {e.code()} — {e.details()}")
        sys.exit(1)
    finally:
        channel.close()


if __name__ == "__main__":
    main()
