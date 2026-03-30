"""
JWT metadata for gRPC calls to the Spring Boot cloud server.

Server expects: metadata ('authorization', 'Bearer <jwt>') with HS256 signed using the same secret as edge.grpc.jwt.secret.

Environment:
  EDGE_GRPC_JWT_ENABLED  - default "true"; set "false" to omit metadata (server must have JWT disabled).
  EDGE_GRPC_JWT_SECRET   - must match Spring Boot edge.grpc.jwt.secret (default matches dev in application.properties).
"""
from __future__ import annotations

import os
import time
from typing import Any

import jwt


def _jwt_enabled() -> bool:
    v = os.environ.get("EDGE_GRPC_JWT_ENABLED", "true").strip().lower()
    return v not in ("0", "false", "no", "off")


def _secret() -> str:
    return os.environ.get(
        "EDGE_GRPC_JWT_SECRET",
        "tomra-edge-jwt-dev-secret-min-32b!!",
    )


def grpc_auth_metadata() -> tuple[tuple[str, str], ...]:
    """Returns gRPC metadata tuple for Authorization Bearer JWT, or empty if JWT is disabled."""
    if not _jwt_enabled():
        return ()
    secret = _secret()
    token = jwt.encode(
        {"sub": "edge-device", "iat": int(time.time())},
        secret,
        algorithm="HS256",
    )
    # PyJWT may return str or bytes depending on version
    if isinstance(token, bytes):
        token = token.decode("ascii")
    return (("authorization", f"Bearer {token}"),)


def metadata_kwargs() -> dict[str, Any]:
    """Use as stub.SomeRpc(req, **metadata_kwargs())."""
    md = list(grpc_auth_metadata())
    if not md:
        return {}
    return {"metadata": md}
