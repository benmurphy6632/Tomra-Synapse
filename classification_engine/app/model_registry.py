from __future__ import annotations

from collections.abc import Callable

import timm
from torchvision.models import AlexNet_Weights, alexnet
from torchvision.models import ConvNeXt_Base_Weights, convnext_base
from torchvision.models import DenseNet201_Weights, densenet201
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0
from torchvision.models import EfficientNet_B1_Weights, efficientnet_b1
from torchvision.models import EfficientNet_B2_Weights, efficientnet_b2
from torchvision.models import EfficientNet_B3_Weights, efficientnet_b3
from torchvision.models import EfficientNet_B4_Weights, efficientnet_b4
from torchvision.models import EfficientNet_B5_Weights, efficientnet_b5
from torchvision.models import EfficientNet_B6_Weights, efficientnet_b6
from torchvision.models import EfficientNet_B7_Weights, efficientnet_b7
from torchvision.models import GoogLeNet_Weights, googlenet
from torchvision.models import MobileNet_V2_Weights, mobilenet_v2
from torchvision.models import MobileNet_V3_Large_Weights, mobilenet_v3_large
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small
from torchvision.models import ResNeXt101_32X8D_Weights, resnext101_32x8d
from torchvision.models import ResNet50_Weights, resnet50
from torchvision.models import ResNet101_Weights, resnet101
from torchvision.models import ResNet152_Weights, resnet152
from torchvision.models import ShuffleNet_V2_X0_5_Weights, shufflenet_v2_x0_5
from torchvision.models import SqueezeNet1_1_Weights, squeezenet1_1
from torchvision.models import Wide_ResNet50_2_Weights, wide_resnet50_2

from app.classifier import Model


def new_timm_model(patch: str):
    return timm.create_model(patch, pretrained=True)


ModelFactory = Callable[[], Model]


def _model_factories() -> dict[str, ModelFactory]:
    return {
        "edge-resnet50-v1": lambda: Model(
            "edge-resnet50-v1",
            resnet50(weights=ResNet50_Weights.IMAGENET1K_V1),
            0,
            ResNet50_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-resnet50-v2": lambda: Model(
            "edge-resnet50-v2",
            resnet50(weights=ResNet50_Weights.IMAGENET1K_V2),
            0,
            ResNet50_Weights.IMAGENET1K_V2,
            None,
            None,
        ),
        "edge_timm_imagenet_21k": lambda: Model(
            "edge_timm_imagenet_21k",
            new_timm_model("vit_base_patch16_224_in21k"),
            0,
            None,
            None,
            None,
        ),
        "edge-efficientnet-b0_v1": lambda: Model(
            "edge-efficientnet-b0_v1",
            efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1),
            0,
            EfficientNet_B0_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-efficientnet-b1_v1": lambda: Model(
            "edge-efficientnet-b1_v1",
            efficientnet_b1(weights=EfficientNet_B1_Weights.IMAGENET1K_V1),
            0,
            EfficientNet_B1_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-efficientnet-b2_v1": lambda: Model(
            "edge-efficientnet-b2_v1",
            efficientnet_b2(weights=EfficientNet_B2_Weights.IMAGENET1K_V1),
            0,
            EfficientNet_B2_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-efficientnet-b3_v1": lambda: Model(
            "edge-efficientnet-b3_v1",
            efficientnet_b3(weights=EfficientNet_B3_Weights.IMAGENET1K_V1),
            0,
            EfficientNet_B3_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-efficientnet-b4_v1": lambda: Model(
            "edge-efficientnet-b4_v1",
            efficientnet_b4(weights=EfficientNet_B4_Weights.IMAGENET1K_V1),
            0,
            EfficientNet_B4_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-efficientnet-b5_v1": lambda: Model(
            "edge-efficientnet-b5_v1",
            efficientnet_b5(weights=EfficientNet_B5_Weights.IMAGENET1K_V1),
            0,
            EfficientNet_B5_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-efficientnet-b6_v1": lambda: Model(
            "edge-efficientnet-b6_v1",
            efficientnet_b6(weights=EfficientNet_B6_Weights.IMAGENET1K_V1),
            0,
            EfficientNet_B6_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-efficientnet-b7_v1": lambda: Model(
            "edge-efficientnet-b7_v1",
            efficientnet_b7(weights=EfficientNet_B7_Weights.IMAGENET1K_V1),
            0,
            EfficientNet_B7_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-googlenet_v1": lambda: Model(
            "edge-googlenet_v1",
            googlenet(weights=GoogLeNet_Weights.IMAGENET1K_V1),
            0,
            GoogLeNet_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-wide_resnet-50_v1": lambda: Model(
            "edge-wide_resnet-50_v1",
            wide_resnet50_2(weights=Wide_ResNet50_2_Weights.IMAGENET1K_V1),
            0,
            Wide_ResNet50_2_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-wide_resnet-50_v2": lambda: Model(
            "edge-wide_resnet-50_v2",
            wide_resnet50_2(weights=Wide_ResNet50_2_Weights.IMAGENET1K_V2),
            0,
            Wide_ResNet50_2_Weights.IMAGENET1K_V2,
            None,
            None,
        ),
        "edge-resnet101_v1": lambda: Model(
            "edge-resnet101_v1",
            resnet101(weights=ResNet101_Weights.IMAGENET1K_V1),
            0,
            ResNet101_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-resnet101_v2": lambda: Model(
            "edge-resnet101_v2",
            resnet101(weights=ResNet101_Weights.IMAGENET1K_V2),
            0,
            ResNet101_Weights.IMAGENET1K_V2,
            None,
            None,
        ),
        "edge-resnet152_v1": lambda: Model(
            "edge-resnet152_v1",
            resnet152(weights=ResNet152_Weights.IMAGENET1K_V1),
            0,
            ResNet152_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-resnet152_v2": lambda: Model(
            "edge-resnet152_v2",
            resnet152(weights=ResNet152_Weights.IMAGENET1K_V2),
            0,
            ResNet152_Weights.IMAGENET1K_V2,
            None,
            None,
        ),
        "edge-mobilenetv2_v1": lambda: Model(
            "edge-mobilenetv2_v1",
            mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V1),
            0,
            MobileNet_V2_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-mobilenetv2_v2": lambda: Model(
            "edge-mobilenetv2_v2",
            mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V2),
            0,
            MobileNet_V2_Weights.IMAGENET1K_V2,
            None,
            None,
        ),
        "edge-mobilenetv3small_v1": lambda: Model(
            "edge-mobilenetv3small_v1",
            mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1),
            0,
            MobileNet_V3_Small_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-mobilenetv3large_v1": lambda: Model(
            "edge-mobilenetv3large_v1",
            mobilenet_v3_large(weights=MobileNet_V3_Large_Weights.IMAGENET1K_V1),
            0,
            MobileNet_V3_Large_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-alexnet_v1": lambda: Model(
            "edge-alexnet_v1",
            alexnet(weights=AlexNet_Weights.IMAGENET1K_V1),
            0,
            AlexNet_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-shufflenet_v1": lambda: Model(
            "edge-shufflenet_v1",
            shufflenet_v2_x0_5(weights=ShuffleNet_V2_X0_5_Weights.IMAGENET1K_V1),
            0,
            ShuffleNet_V2_X0_5_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-densenet201_v1": lambda: Model(
            "edge-densenet201_v1",
            densenet201(weights=DenseNet201_Weights.IMAGENET1K_V1),
            0,
            DenseNet201_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-squeezenet1_1_v1": lambda: Model(
            "edge-squeezenet1_1_v1",
            squeezenet1_1(weights=SqueezeNet1_1_Weights.IMAGENET1K_V1),
            0,
            SqueezeNet1_1_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-resnex101_32x8_v1": lambda: Model(
            "edge-resnex101_32x8_v1",
            resnext101_32x8d(weights=ResNeXt101_32X8D_Weights.IMAGENET1K_V1),
            0,
            ResNeXt101_32X8D_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
        "edge-resnex101_32x8_v2": lambda: Model(
            "edge-resnex101_32x8_v2",
            resnext101_32x8d(weights=ResNeXt101_32X8D_Weights.IMAGENET1K_V2),
            0,
            ResNeXt101_32X8D_Weights.IMAGENET1K_V2,
            None,
            None,
        ),
        "edge-convnext_base_v1": lambda: Model(
            "edge-convnext_base_v1",
            convnext_base(weights=ConvNeXt_Base_Weights.IMAGENET1K_V1),
            0,
            ConvNeXt_Base_Weights.IMAGENET1K_V1,
            None,
            None,
        ),
    }


def get_model_names() -> list[str]:
    return list(_model_factories().keys())


def get_model(model_name: str) -> Model:
    factories = _model_factories()

    if model_name not in factories:
        raise ValueError(f"Model not found in registry: {model_name}")

    return factories[model_name]()


def get_models() -> list[Model]:
    return [factory() for factory in _model_factories().values()]


def build_session_models(
    stable_model_name: str | None,
    canary_model_name: str | None,
    stable_percent: int,
    canary_percent: int,
) -> list[Model]:
    """
    Return only the models selected by the active session, loading only
    the required model objects for that session.
    """
    normalized_stable = stable_model_name.strip() if stable_model_name else None
    normalized_canary = canary_model_name.strip() if canary_model_name else None

    if normalized_stable == "None":
        normalized_stable = None
    if normalized_canary == "None":
        normalized_canary = None

    has_stable = normalized_stable is not None
    has_canary = normalized_canary is not None

    if not has_stable and not has_canary:
        raise ValueError("Active session does not contain any selected models")

    if has_stable and has_canary and normalized_stable == normalized_canary:
        raise ValueError("Stable and canary model cannot be the same")

    selected_models: list[Model] = []

    if has_stable:
        stable_model = get_model(normalized_stable)
        stable_model.canary_percentage = stable_percent if has_canary else 100
        selected_models.append(stable_model)

    if has_canary:
        canary_model = get_model(normalized_canary)
        canary_model.canary_percentage = canary_percent if has_stable else 100
        selected_models.append(canary_model)

    total = sum(model.canary_percentage for model in selected_models)
    if total != 100:
        raise ValueError(
            f"Configured session model percentages must sum to 100, got {total}"
        )

    return selected_models