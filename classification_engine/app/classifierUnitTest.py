from classification_engine.app import classifier
import unittest
from unittest.mock import patch

# Torchvision - Image recognition library, needs to be loaded with pretrained models
import torch
from PIL import Image
from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights, efficientnet_b0, EfficientNet_B0_Weights

import os

# Test 20k database
import timm

from classification_engine.app import imagenet21k_id_to_label

# Tell torchvision to use cached weights only in CI — prevents network calls
if os.environ.get("CI"):
    os.environ["TORCH_HOME"] = "/root/.cache/torch"

# Patch out the image upload for all tests — CI has no internet access
# and upload is not what we're testing here
patch("classification_engine.app.UploadImage.upload_image_and_get_url", return_value="https://mock-url.com/image.jpg").start()

class testInit(unittest.TestCase):

    # Test that the user can run CUDA.
    def has_CUDA(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 40, ResNet50_Weights.IMAGENET1K_V1, None, None))
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V2), 60, ResNet50_Weights.IMAGENET1K_V2, None, None))

        self.assertNotEqual(torch.version.cuda, "None")
        self.assertNotEqual(torch.cuda.is_available(), 0)

    # Check that the model is named correctly are the input.
    def test_model_named(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 40, ResNet50_Weights.IMAGENET1K_V1, None, None))
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V2), 60, ResNet50_Weights.IMAGENET1K_V2, None, None))

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        self.assertEqual(classifierEngine.models[0].model_name, "TestModelName")

    # Ensure that the model is properly following the ResNet50 categories.
    # If we change the model from ResNet50, this should be adjusted.
    def test_categories(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 40, ResNet50_Weights.IMAGENET1K_V1, None, None))
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V2), 60, ResNet50_Weights.IMAGENET1K_V2, None, None))

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        self.assertEqual(classifierEngine.models[0].categories, ResNet50_Weights.DEFAULT.meta["categories"])

    # Check that the test image preprocesses correctly.
    def test_preprocess(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 40, ResNet50_Weights.IMAGENET1K_V1, None, None))
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V2), 60, ResNet50_Weights.IMAGENET1K_V2, None, None))

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        images = [Image.open("classification_engine/app/ApplesAndOranges/orange.jpg").convert("RGB"), Image.open("classification_engine/app/ApplesAndOranges/apple.jpg").convert("RGB")]

        # Training set ImageNet values.
        # Change this if ImageNet is changed for something else.
        IMAGENET_AVG_R = 0.485
        IMAGENET_AVG_G = 0.456
        IMAGENET_AVG_B = 0.406
        IMAGENET_AVG_STD_R = 0.229
        IMAGENET_AVG_STD_G = 0.224
        IMAGENET_AVG_STD_B = 0.225
        MODEL_INPUT_SIZE = 256
        MODEL_CENTER_CROP = 224

        preprocess = transforms.Compose([
            transforms.Resize(MODEL_INPUT_SIZE),
            transforms.CenterCrop(MODEL_CENTER_CROP),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[IMAGENET_AVG_R, IMAGENET_AVG_G, IMAGENET_AVG_B],
                std=[IMAGENET_AVG_STD_R, IMAGENET_AVG_STD_G, IMAGENET_AVG_STD_B]
                )
            ])

        classifierEngine.prepare_model(classifierEngine.models[0])
        correctResult = torch.stack([preprocess(images[0]), preprocess(images[1])])
        self.assertTrue(torch.equal(classifierEngine.preprocess_images(images), correctResult))

    # Ensure correct Class ID (950 for orange)
    def test_class_id(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 40, ResNet50_Weights.IMAGENET1K_V1, None, None))
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V2), 60, ResNet50_Weights.IMAGENET1K_V2, None, None))

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        image = Image.open("classification_engine/app/ApplesAndOranges/orange.jpg")
        self.assertEqual(classifierEngine.classify_image(image).class_id, 950)

    # Ensure correct Label (eg "orange" for orange)
    def test_label(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 40, ResNet50_Weights.IMAGENET1K_V1, None, None))
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V2), 60, ResNet50_Weights.IMAGENET1K_V2, None, None))

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        image = Image.open("classification_engine/app/ApplesAndOranges/orange.jpg")
        self.assertEqual(classifierEngine.classify_image(image).label, "orange")

    # Make sure that models other than resnet50 work
    def test_efficient_net_model(self):
        models = []
        models.append(classifier.Model("TestModelName", efficientnet_b0(weights=EfficientNet_B0_Weights), 100, EfficientNet_B0_Weights.IMAGENET1K_V1, None, None))

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        image = Image.open("classification_engine/app/ApplesAndOranges/orange.jpg")
        self.assertEqual(classifierEngine.classify_image(image).label, "orange")

    # Ensure confidence above reasonable threshold
    # This orange is really "orange"-ey, so it should be very high
    def test_confidence(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 40, ResNet50_Weights.IMAGENET1K_V1, None, None))
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V2), 60, ResNet50_Weights.IMAGENET1K_V2, None, None))

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        image = Image.open("classification_engine/app/ApplesAndOranges/orange.jpg")
        self.assertGreater(classifierEngine.classify_image(image).confidence, 0.1)

    # Ensure correct model name displayed in created image
    def test_model_name_image(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 40, ResNet50_Weights.IMAGENET1K_V1, None, None))
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V2), 60, ResNet50_Weights.IMAGENET1K_V2, None, None))

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        image = Image.open("classification_engine/app/ApplesAndOranges/orange.jpg")
        self.assertEqual(classifierEngine.classify_image(image).model, "TestModelName")

    # Ensure latency in reasonable range
    # It shouldn't be crazy high or crazy low.
    def test_latency(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 40, ResNet50_Weights.IMAGENET1K_V1, None, None))
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V2), 60, ResNet50_Weights.IMAGENET1K_V2, None, None))

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        image = Image.open("classification_engine/app/ApplesAndOranges/orange.jpg")
        self.assertGreater(classifierEngine.classify_image(image).latency, 0, "Latency <=0!")
        self.assertLess(classifierEngine.classify_image(image).latency, 10, "Extremely high latency!")

    # Ensure power is nonzero. If it's zero we're doing this wrong and it's a bad sign
    def test_power_usage(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 100, ResNet50_Weights.IMAGENET1K_V1, None, None))
        classifierEngine = classifier.ImageClassifierEngine(models=models)
        image = Image.open("classification_engine/app/ApplesAndOranges/orange.jpg")
        self.assertGreater(classifierEngine.classify_image(image).power_usage, 0, "Power <=0!")

    # Ensure CO2 emissions are nonzero. If it's zero we're doing this wrong and it's a bad sign
    def test_co2_emissions(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 100, ResNet50_Weights.IMAGENET1K_V1, None, None))
        classifierEngine = classifier.ImageClassifierEngine(models=models)
        image = Image.open("classification_engine/app/ApplesAndOranges/orange.jpg")
        self.assertGreater(classifierEngine.classify_image(image).co2_emissions, 0, "CO2 emissions <=0!")
        print(classifierEngine.classify_image(image).co2_emissions)

    # Ensure folder loads images correctly.
    def test_folder_load(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 40, ResNet50_Weights.IMAGENET1K_V1, None, None))
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V2), 60, ResNet50_Weights.IMAGENET1K_V2, None, None))

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        folderImages = classifierEngine.load_folder_images("classification_engine/app/ApplesAndOranges")

        # Check correct number of images loaded (ordering is filesystem-dependent so we don't assert order)
        self.assertEqual(len(folderImages), 2)
        # Check all loaded items are PIL Images
        for img in folderImages:
            self.assertIsInstance(img, Image.Image)

    # Ensure images are correctly processed in batch.
    def test_classify_images_multimodel(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 100, ResNet50_Weights.IMAGENET1K_V1, None, None))

        image0 = Image.open("classification_engine/app/ApplesAndOranges/apple.jpg")
        image1 = Image.open("classification_engine/app/ApplesAndOranges/orange.jpg")

        images = [image0, image1]

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        imageArrayClassification = classifierEngine.classify_images_multimodel(images)

        image0Classification = classifierEngine.classify_images_multimodel([image0])[0]
        image1Classification = classifierEngine.classify_images_multimodel([image1])[0]

        self.assertEqual(image0Classification.label, imageArrayClassification[0].label)
        self.assertEqual(image1Classification.label, imageArrayClassification[1].label)
        self.assertAlmostEqual(image0Classification.confidence, imageArrayClassification[0].confidence, places=3)
        self.assertAlmostEqual(image1Classification.confidence, imageArrayClassification[1].confidence, places=3)
        self.assertEqual(image0Classification.model, imageArrayClassification[0].model)
        self.assertEqual(image1Classification.model, imageArrayClassification[1].model)
        self.assertEqual(image0Classification.class_id, imageArrayClassification[0].class_id)
        self.assertEqual(image1Classification.class_id, imageArrayClassification[1].class_id)

   # Ensure correct id for timm (eg "04965179" for orange)
    def test_timm_id(self):
        models = []
        models.append(classifier.Model("timm_imagenet_20k",timm.create_model("vit_base_patch16_224_in21k", pretrained=True),100,None,None,None))

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        image = Image.open("classification_engine/app/ApplesAndOranges/orange.jpg")
        self.assertEqual(classifierEngine.classify_image(image).class_id, 13046)

   # Ensure correct Label for timm (eg "orange" for orange)
    def test_timm_label(self):
        models = []
        models.append(classifier.Model("timm_imagenet_20k",timm.create_model("vit_base_patch16_224_in21k", pretrained=True),100,None,None,None))

        imagenet21k_id_to_label.compose_imagenet_21k_dict()

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        image = Image.open("classification_engine/app/ApplesAndOranges/orange.jpg")
        self.assertEqual(classifierEngine.classify_image(image).label, "orange")


    # Test that timm for imagenet21k is working right
    def test_multimodel_timm(self):
        models = []


        models.append(classifier.Model("timm_imagenet_20k",timm.create_model("vit_base_patch16_224_in21k", pretrained=True),100,None,None,None))

        image0 = Image.open("classification_engine/app/ApplesAndOranges/apple.jpg")
        image1 = Image.open("classification_engine/app/ApplesAndOranges/orange.jpg")

        images = [image0, image1]

        classifierEngine = classifier.ImageClassifierEngine(models=models)

        imageArrayClassification = classifierEngine.classify_images_multimodel(images)

        image0Classification = classifierEngine.classify_images_multimodel([image0])[0]
        image1Classification = classifierEngine.classify_images_multimodel([image1])[0]


        self.assertEqual(image0Classification.label, imageArrayClassification[0].label)
        self.assertEqual(image1Classification.label, imageArrayClassification[1].label)
        self.assertAlmostEqual(image0Classification.confidence, imageArrayClassification[0].confidence, places=3)
        self.assertAlmostEqual(image1Classification.confidence, imageArrayClassification[1].confidence, places=3)
        self.assertEqual(image0Classification.model, imageArrayClassification[0].model)
        self.assertEqual(image1Classification.model, imageArrayClassification[1].model)
        self.assertEqual(image0Classification.class_id, imageArrayClassification[0].class_id)
        self.assertEqual(image1Classification.class_id, imageArrayClassification[1].class_id)

    # Ensure that the classification result printing is correct.
    def test_classification_result_string(self):
        models = []
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V1), 40, ResNet50_Weights.IMAGENET1K_V1, None, None))
        models.append(classifier.Model("TestModelName", resnet50(weights=ResNet50_Weights.IMAGENET1K_V2), 60, ResNet50_Weights.IMAGENET1K_V2, None, None))

        classifierEngine = classifier.ImageClassifierEngine(models=models)
        self.assertEqual(
            classifierEngine.get_classification_result_string(
                classifier.ClassificationResult(
                    label="apple",
                    confidence="0.5",
                    model="TestModelName",
                    class_id="10",
                    latency=0.1,
                    image_url="1234",
                    power_usage=0.5,
                    co2_emissions=0.02,
                )
            ),
            "\nLabel: apple\nConfidence: 0.5\nModel: TestModelName\nClass ID: 10\nLatency: 0.1\nImage URL: 1234\nPower: 0.5\nCO2 Emissions: 0.02"
        )