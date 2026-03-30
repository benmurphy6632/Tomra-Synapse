# ---- Build Stage ----
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential linux-libc-dev && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip && \
    pip install grpcio-tools

COPY classification_engine/requirements.txt .
RUN pip install -r requirements.txt

COPY contracts/grpc/ ./contracts/grpc/
RUN mkdir -p ./app/generated && \
    touch ./app/generated/__init__.py && \
    python -m grpc_tools.protoc \
    -I./contracts/grpc \
    --python_out=./app/generated \
    --grpc_python_out=./app/generated \
    ./contracts/grpc/result_receiver.proto && \
    sed -i 's/import result_receiver_pb2/from app.generated import result_receiver_pb2/' \
    ./app/generated/result_receiver_pb2_grpc.py

# ---- Run Stage ----
FROM python:3.11-slim

WORKDIR /app

RUN addgroup --system appgroup && \
    adduser --system --ingroup appgroup --home /home/appuser appuser

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY classification_engine/app/ ./app/
COPY --from=builder /app/app/generated ./app/generated

RUN mkdir -p /home/appuser/.cache/torch \
    /home/appuser/.cache/huggingface \
    /home/appuser/.cache/huggingface/transformers && \
    chown -R appuser:appgroup /app /home/appuser

USER appuser

ENV HOME=/home/appuser
ENV XDG_CACHE_HOME=/home/appuser/.cache
ENV HF_HOME=/home/appuser/.cache/huggingface
ENV TRANSFORMERS_CACHE=/home/appuser/.cache/huggingface/transformers
ENV TORCH_HOME=/home/appuser/.cache/torch

ENV CLOUD_HOST=hopper.proxy.rlwy.net
ENV CLOUD_PORT=28253
ENV GRAPHQL_URL=https://tomra-synapse-backend-production.up.railway.app/graphql
ENV DEVICE_ID=edge-device-001
ENV IMAGE_FOLDER=/images

CMD ["python", "-m", "app.engine_service"]