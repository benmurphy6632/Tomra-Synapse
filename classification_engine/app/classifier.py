# classification-engine/app/classifier.py
# A reusable image classification engine that was modified
from __future__ import annotations
from dataclasses import dataclass

# Randomness needed for canary choosing. We could potentially change this later to make it more balanced
import random

# Torchvision - Image recognition library, needs to be loaded with pretrained models
import torch

# Cuda allows torch to use GPU instead of CPU when it comes to image processing.
# As you probably know, image recognition relies on a bunch of parallel matrix
# operations, which GPU does way faster than CPU. Unfortunately, getting CUDA
# to work is hard.
# Uninstall torch if you already have it with pip uninstall torch torchvision torchaudio
# Use pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu126
# ENSURE Python Interpreter is 3.12 or lower with Ctrl+Shift+P - IMPORTANT!!

# If this still doesn't work, try these steps... I don't know if they're necessary...
# First install CUDA: https://developer.nvidia.com/cuda-downloads
# Next, open NVIDIA Control Panel... (If this doesn't exist, I don't think you can use CUDA)
# Go onto 3D settings...
# Switch preferred Graphics Processor to High-Performance NVIDIA Processor
# Ensure your driver is version >530, check using nvidia-smi on terminal.
# Considering how NVIDIA Cuda is 2 gigabytes as an .exe file...
# This might be a consideration when it comes to dockerisation...
import torch.cuda

from torchvision import transforms

# Needed for multiple models
import torch.nn as nn

from PIL import Image
from torchvision.models import resnet50, ResNet50_Weights

import os  # Needed for folder directories.

import time  # Time for manual CPU latency
from app import UploadImage

# String Tuple of all accepted image types for the classifier (eg. png, jpg)
# Gif files should be ignored for example, because they have multiple frames.
ACCEPTED_IMAGE_TYPES = (".png", ".jpg", ".jpeg")

# FIX 1: Was "MILISECONDS_IN_SECOND" (one L) — caused NameError on the CUDA latency path
MILLISECONDS_IN_SECOND = 1000

SECONDS_IN_HOUR = 3600

WATTS_IN_KILOWATT = 1000

# We're going with 200gCo2/kW here.
# Although Ireland in February 2025 has hit 187gCo2/kW in February 2025, this is a historic low.
# So bringing it upwards about 10% makes it a more reasonable estimate.
# Source: https://currents.greencollective.io/irish-grid-monthly-recap-february-2025/
IRELAND_2025_GRID_INTENSITY = 200

# Need subprocess for NVIDIA SMI calculations
import subprocess

import threading  # To sample the power used over the function

# Measure CPU Usage (Note: Possibly Linux and Windows only, may need to check it works with Mac)
import psutil

# ImageNet 21k conversions if such a model is available
from app import imagenet21k_id_to_label


# Class for a processed image. This will contain data such as what the image is...
# Contains...
# "filename" -> Name of the input file - Removed due to redundancy
# "class_id" -> Class ID of the image (eg. 948, which represents "mushroom")
# label -> The string label of that Class ID (eg. "mushroom" if ID = 948)
# confidence -> The confidence level that the image is indeed this one.
# latency -> The time in seconds taken for model evaluation.
# image_url -> The URL of the image we uploaded
# co2_emissions -> CO2 emissions in g for the Classification. Doesn't account for any datacentres
@dataclass(frozen=True)
class ClassificationResult:
    label: str
    confidence: float
    model: str
    # filename: str - Filename removed due to redundancy.
    class_id: int
    latency: float
    image_url: str
    power_usage: float
    co2_emissions: float


# FIX 2: Removed duplicate Model dataclass definition (was defined twice identically)
@dataclass(frozen=False)
class Model:
    model_name: str
    model_module: nn.Module
    canary_percentage: int
    weights: any
    # These three parameters don't need to be defined at the start
    transforms: any
    categories: any


class ImageClassifierEngine:
    def __init__(self, models=None) -> None:
        self.hasCuda = torch.cuda.is_available()  # Track whether GPU use is possible

        self.models = models or []  # Use [] if none sent

        if self.models == []:
            raise RuntimeError("No models provided!")

        # Check that the canary percentages actually add up
        if sum(model.canary_percentage for model in self.models) != 100:
            raise ValueError("Model percentages don't sum to 100!")

        # Intialise the conditions for each model to work
        for model in self.models:
            model.model_module.eval()
            if self.hasCuda:
                model.model_module.cuda()

            # timm model -> Uses pretrained config instead of pytorch weights
            if hasattr(model.model_module, "pretrained_cfg"):
                cfg = model.model_module.pretrained_cfg
                model.transforms = self.build_timm_transforms(cfg)
                model.categories = None
            # Otherwise do it model.weights.transforms style
            else:
                model.transforms = model.weights.transforms()
                model.categories = model.weights.meta["categories"]

    # Gets the transforms for a timmm model given a config
    def build_timm_transforms(self, cfg):
        return transforms.Compose(
            [
                transforms.Resize(cfg["input_size"][1]),
                transforms.CenterCrop(cfg["input_size"][1]),
                transforms.ToTensor(),
                transforms.Normalize(mean=cfg["mean"], std=cfg["std"]),
            ]
        )

    # Prepares the chosen model to be used for the image
    def prepare_model(self, model):
        self.weights = model.weights
        self.preprocess = model.transforms
        self.categories = model.categories

    # Chooses a model (randomly) by going through each of the models' canary percentages
    def select_model_by_canary_percentage(self):
        if len(self.models) == 1:
            return self.models[0]

        chosen_percentage = random.randint(1, 100)
        current_percentage = 0

        for model in self.models:
            current_percentage += model.canary_percentage
            if current_percentage >= chosen_percentage:
                return model

        raise RuntimeError("No model selected by canary percentage!")

    # Preprocesses images so it can be used for the model.
    def preprocess_images(self, imgs):
        # Do RGB conversions for all images
        return torch.stack([self.preprocess(img.convert("RGB")) for img in imgs])

    # Classifies a singular image without batch processing (Much slower than batch)
    def classify_image(self, image):
        current_model = self.select_model_by_canary_percentage()
        return self.classify_images(images=[image], current_model=current_model)[0]

    # Preprocesses the image and then classifies it and stores it into a ClassificationResult data structure.
    def classify_images(self, images, current_model) -> list[ClassificationResult]:
        self.prepare_model(current_model)

        # Skip classification and return empty list if no images provided
        if not images:
            return []

        # Calculate GPU power usage
        self.stopflag = False
        self.current_image_energy = 0
        self.power_thread = threading.Thread(target=self.power_sample_thread)
        self.power_thread.start()

        # CUDA events - used for accurate synchronisation during evaluation.
        # We need this to correctly evaluate latency.
        # Latency is tracked using CUDA if available, otherwise just track using Time library.
        if self.hasCuda:
            start_time = torch.cuda.Event(enable_timing=True)
            end_time = torch.cuda.Event(enable_timing=True)
        else:
            start_time = time.time()

        # Use CUDA to preprocess if possible
        if self.hasCuda:
            tensor = self.preprocess_images(images).cuda()  # shape [N, 3, 224, 224]
        else:  # Otherwise manual
            tensor = self.preprocess_images(images)

        # Using inference mode instead of no_grad to get better performance.
        # Green Computing consideration.
        # Inference mode isn't compatible with certain advanced AI features, but that's
        # beyond the scope of our project.
        with torch.inference_mode():
            if self.hasCuda:
                start_time.record()

            logits = current_model.model_module(tensor)

            if self.hasCuda:
                end_time.record()

            if self.hasCuda:  # GPU CUDA Time tracking.
                torch.cuda.synchronize()  # GPU Synchronise
                # FIX 3: Was MILISECONDS_IN_SECOND (typo) — now MILLISECONDS_IN_SECOND
                latency = start_time.elapsed_time(end_time) / MILLISECONDS_IN_SECOND
            else:
                end_time = time.time()
                latency = end_time - start_time

        # Stop power sampling thread
        self.stopflag = True
        self.power_thread.join()

        if latency > 0:
            power_usage = self.current_image_energy / latency
        else:
            power_usage = 0.0

        # Divide latency by the number of images since we did multiple at once
        latency /= len(images)

        probs = torch.nn.functional.softmax(logits, dim=1)
        class_ids = torch.argmax(probs, dim=1)

        # FIX 4: Was building results in a loop but returning outside it (only ever returned
        # the last image's result as a single object, not a list). Now correctly appends
        # each result and returns the full list.
        # FIX 5: Was using self.model_name which doesn't exist on the engine —
        # correctly use current_model.model_name instead.
        classification_results = []
        for i, image in enumerate(images):
            class_id = int(class_ids[i].item())
            confidence = float(probs[i, class_id].item())

            # If timm model, translate id to label using dict from the 21k library
            if self.categories is None:
                if imagenet21k_id_to_label.imagenet21k_dict_empty():
                    imagenet21k_id_to_label.compose_imagenet_21k_dict()

                label = imagenet21k_id_to_label.get_label_from_imagenet_21k(class_id)

                if label is None:
                    label = f"class_{class_id}"
            else:
                label = self.categories[class_id]

            image_url = UploadImage.upload_image_and_get_url(image.filename)
            co2_emissions = (
                power_usage
                * IRELAND_2025_GRID_INTENSITY
                * latency
                / WATTS_IN_KILOWATT
                / SECONDS_IN_HOUR
            )
            classification_results.append(
                ClassificationResult(
                    label=label,
                    confidence=confidence,
                    model=current_model.model_name,  # FIX 5
                    class_id=class_id,
                    latency=latency,
                    image_url=image_url,
                    power_usage=power_usage,
                    co2_emissions=co2_emissions,
                )
            )

        return classification_results  # FIX 4

    # Runs a thread (On CPU) that samples the power every 0.05 secs
    def power_sample_thread(self):
        if self.hasCuda:
            period = 0.05
            while not self.stopflag:
                power = self.get_GPU_power()
                self.current_image_energy += power * period
                time.sleep(period)
        else:
            period = 0.05
            while not self.stopflag:
                power = self.get_CPU_power()
                self.current_image_energy += power * period
                time.sleep(period)

    def get_GPU_power(self):
        try:
            # nvidia-smi returns current power draw in watts
            output = subprocess.check_output(
                [
                    "nvidia-smi",
                    "--query-gpu=power.draw",
                    "--format=csv,noheader,nounits",
                ]
            )
            return float(output.strip())
        except Exception:
            return 0.0

    def get_CPU_power(self):
        # Thermal Design Power - 30 is a typical average for a high-end laptop so that's what we're going with here
        # A lower end laptop can be as low as 5-9. It's not a perfect estimate, but there's no way to
        # Calculate for all computers unless we had a wattmeter (Which the user likely won't.)
        tdp = 30
        return (psutil.cpu_percent() / 100) * tdp

    # Evaluates an array of images, adds them to their respective model and classifies
    def classify_images_multimodel(self, images):
        resultArray = []

        # Create 2D arrays containing image and its model
        model_sorted_images = [[] for model in self.models]
        for image in images:
            current_model = self.select_model_by_canary_percentage()
            current_model_index = self.models.index(current_model)
            model_sorted_images[current_model_index].append(image)

        # Initialise the ImageNET21k library if ImageNet21k is found
        for model in self.models:
            if hasattr(model.model_module, "pretrained_cfg"):
                if imagenet21k_id_to_label.imagenet21k_dict_empty():
                    imagenet21k_id_to_label.compose_imagenet_21k_dict()

        # Classify all images in the model via batch
        for model in self.models:
            classification_results = self.classify_images(
                model_sorted_images[self.models.index(model)], model
            )
            for result in classification_results:
                resultArray.append(result)

        return resultArray

    # Loads all images in folder - We're going to use the "Image Input" folder here.
    # Returns as image array
    def load_folder_images(self, folder):
        images = []
        for filename in os.listdir(folder):
            # Prevent non-image files (eg. txt) from being read.
            if filename.lower().endswith(ACCEPTED_IMAGE_TYPES):
                img = Image.open(os.path.join(folder, filename))
                if img is not None:
                    images.append(img)
        return images

    # Prints the values of a classification result - used for debugging.
    def print_classification_result(self, cr: ClassificationResult):
        print(self.get_classification_result_string(cr=cr))

    # Displays a classification result as a reasonably structured string.
    def get_classification_result_string(self, cr: ClassificationResult):
        # FIX 6: Was outputting "URL:" then "Image URL:" (duplicate, wrong label).
        # Now outputs "Image URL:" once, matching what the test expects.
        return (
            "\nLabel: " + str(cr.label)
            + "\nConfidence: " + str(cr.confidence)
            + "\nModel: " + str(cr.model)
            + "\nClass ID: " + str(cr.class_id)
            + "\nLatency: " + str(cr.latency)
            + "\nImage URL: " + str(cr.image_url)
            + "\nPower: " + str(cr.power_usage)
            + "\nCO2 Emissions: " + str(cr.co2_emissions)
        )