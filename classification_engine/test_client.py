# test_client.py
from pathlib import Path
import sys

# Generated stubs use `import result_receiver_pb2`; app/generated must be on path first
_SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPT_DIR / "app" / "generated"))

import grpc
from app.classifier import ImageClassifierEngine
from app.generated import result_receiver_pb2 as pb2
from app.generated import result_receiver_pb2_grpc as pb2_grpc
from app.jwt_grpc import metadata_kwargs

def test_classify(image_path: str, classifier, stub):
    """Classify a single image and send result to gRPC server"""
    image_path = Path(image_path)
    if not image_path.exists():
        print(f"Image not found: {image_path}")
        return

    # Read image bytes
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    # Classify image
    from PIL import Image
    img = Image.open(image_path)
    result = classifier.classify_image(img)

    # Build gRPC request
    request = pb2.ClassificationResult(
        ID="test-device",
        image_name=image_path.name,
        predicted_label=result.label,
        confidence=result.confidence,
        model=result.model,
        # Tommy - Is this why Images aren't sending across? Shouldn't it be image_url = image_url??
        # Idk if this is fixed on another branch so not changing yet.
        #image_url=image_bytes,  #John : need to send URL, not fixing rn
        image_url=result.image_url,
        power_usage=result.power_usage,
        co2_emissions=result.co2_emissions,
        classID=result.class_id
    )

    # Send to gRPC server (JWT metadata when EDGE_GRPC_JWT_ENABLED=true)
    ack = stub.SubmitResult(request, **metadata_kwargs())
    print(f"{image_path.name:30} → {result.label:30} ({result.confidence:.2%}) | ack: {ack.received}")


def test_classify_folder(folder_path: str, classifier, stub):
    """Classify all images in a folder"""
    folder = Path(folder_path)
    image_files = [f for f in folder.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png")]

    if not image_files:
        print(f"No images found in {folder_path}")
        return

    print(f"Found {len(image_files)} images in {folder_path}\n")

    for img_path in sorted(image_files):
        test_classify(img_path, classifier, stub)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Single image: python test_client.py <image_path>")
        print("  Folder:       python test_client.py --folder <folder_path>")
        sys.exit(1)

    # Initialize classifier
    print("[Client] Loading classifier...")
    classifier = ImageClassifierEngine(model_name="test-resnet50")

    # Connect to gRPC server
    channel = grpc.insecure_channel("localhost:9090")  # Match your Spring Boot gRPC port
    stub = pb2_grpc.ResultReceiverServiceStub(channel)

    if sys.argv[1] == "--folder":
        folder_path = sys.argv[2]
        test_classify_folder(folder_path, classifier, stub)
    else:
        image_path = sys.argv[1]
        test_classify(image_path, classifier, stub)
