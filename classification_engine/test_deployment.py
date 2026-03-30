"""
test_deployment.py

TEMPORARY TEST SCRIPT — tests the full cloud-to-edge deployment pipeline
without needing the frontend or a real edge device running.

This script simulates what the edge device will do in production:
1. Opens a SubscribeToDeployments stream on startup
2. Listens for DeploymentCommand messages from the backend
3. When a command arrives, prints the details
4. Sends an AcknowledgeDeployment back to confirm

HOW TO USE:
-----------
Step 1: Start the Spring Boot backend
    cd backend
    ./mvnw spring-boot:run

Step 2: Run this script in a separate terminal
    cd classification_engine
    source venv/bin/activate
    python3 test_deployment.py

Step 3: In a third terminal, trigger a deployment via curl
    curl -X POST http://localhost:8080/test/deploy \
         -H "Content-Type: application/json" \
         -d '{"modelName":"resnet101","canaryPercentage":10}'

Step 4: Watch this script receive and print the DeploymentCommand,
        then check the backend logs for the AcknowledgeDeployment.

EXPECTED OUTPUT:
----------------
[test_deployment] Connecting to backend at localhost:9090...
[test_deployment] Stream open — waiting for deployment commands...
[test_deployment] DeploymentCommand received:
  Model:      resnet101
  Canary:     10%
  Deploy ID:  <uuid>
[test_deployment] Sending acknowledgement back to backend...
[test_deployment] Acknowledgement received from backend: Deployment acknowledgement received
"""

import grpc
import sys
import os

# classification_engine root so we can import app.jwt_grpc
sys.path.insert(0, os.path.dirname(__file__))
# Add the app/generated directory to the path so we can import the generated stubs
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app', 'generated'))

from app.jwt_grpc import metadata_kwargs

import result_receiver_pb2
import result_receiver_pb2_grpc

# Address of the Spring Boot backend gRPC server
BACKEND_ADDRESS = 'localhost:9090'

# Device ID to identify this test edge device
DEVICE_ID = 'test-edge-device-01'


def run():
    print(f"[test_deployment] Connecting to backend at {BACKEND_ADDRESS}...")

    # Open an insecure gRPC channel to the backend
    # In production this would use TLS credentials
    with grpc.insecure_channel(BACKEND_ADDRESS) as channel:
        stub = result_receiver_pb2_grpc.ResultReceiverServiceStub(channel)

        # Build the EdgeDeviceRegistration message to identify this device
        registration = result_receiver_pb2.EdgeDeviceRegistration(
            device_id=DEVICE_ID
        )

        print("[test_deployment] Stream open — waiting for deployment commands...")
        print("[test_deployment] Trigger a deployment with:")
        print("  curl -X POST http://localhost:8080/test/deploy \\")
        print("       -H \"Content-Type: application/json\" \\")
        print("       -d '{\"modelName\":\"resnet101\",\"canaryPercentage\":10}'")
        print()

        # Open the server-streaming RPC — this blocks and waits for commands
        # In production this runs in a background thread
        _md = metadata_kwargs()
        for command in stub.SubscribeToDeployments(registration, **_md):
            print("[test_deployment] DeploymentCommand received:")
            print(f"  Model:      {command.model_name}")
            print(f"  Canary:     {command.canary_percentage}%")
            print(f"  Deploy ID:  {command.deployment_id}")
            print()

            # Send acknowledgement back to the backend
            print("[test_deployment] Sending acknowledgement back to backend...")
            ack_request = result_receiver_pb2.DeploymentAcknowledgement(
                device_id=DEVICE_ID,
                deployment_id=command.deployment_id,
                loaded_model=command.model_name,
                success=True,
                message=f"{command.model_name} loaded successfully, canary at {command.canary_percentage}%"
            )

            ack_response = stub.AcknowledgeDeployment(ack_request, **_md)
            print(f"[test_deployment] Acknowledgement received from backend: {ack_response.message}")
            print()
            print("[test_deployment] Waiting for next deployment command...")


if __name__ == '__main__':
    try:
        run()
    except KeyboardInterrupt:
        print("\n[test_deployment] Stopped by user")
    except grpc.RpcError as e:
        print(f"[test_deployment] gRPC error: {e.code()} — {e.details()}")
        print("[test_deployment] Is the Spring Boot backend running on port 9090?")