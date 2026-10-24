import torch
import torch.nn as nn
import torchvision.models as models

# 1. Load pretrained ResNet-50
model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)

# 2. Replace the final FC layer with Identity to output 2048-d feature embeddings
model.fc = nn.Identity()
model.eval()

# 3. Export to ONNX
dummy_input = torch.randn(1, 3, 224, 224)
torch.onnx.export(
    model,
    dummy_input,
    "artifacts/resnet50.onnx",
    export_params=True,
    opset_version=14,
    do_constant_folding=True,
    input_names=["input"],
    output_names=["output"]
)

print("Saved 2048-d feature extractor to artifacts/resnet50.onnx")