# JWT authentication (edge → cloud gRPC)

Edge devices authenticate to the Spring Boot gRPC server on port **9090** by sending a **Bearer JWT** in gRPC metadata:

- Metadata key: `authorization`
- Value: `Bearer <jwt>`

The token is signed with **HS256** using the shared secret configured as:

- `edge.grpc.jwt.secret` (Spring Boot)
- `EDGE_GRPC_JWT_SECRET` (Python, optional; defaults match dev secret in `application.properties`)

Toggle enforcement:

- `edge.grpc.jwt.enabled=true` — require a valid JWT on every gRPC call (default in `application.properties`).
- `edge.grpc.jwt.enabled=false` — no check (useful for local tests; tests use `src/test/resources/application.properties`).

**Python:** use `app/jwt_grpc.py` → `grpc_auth_metadata()` and pass `metadata=...` to stubs. Set `EDGE_GRPC_JWT_ENABLED=false` to skip sending a token (only works if the server also has JWT disabled).

**Production:** set a strong random secret (≥ 32 bytes), inject via environment or config, and keep it identical on edge and cloud.
