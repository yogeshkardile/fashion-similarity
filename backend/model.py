import torch
from PIL import Image
from torchvision import models
from torchvision.models import ResNet50_Weights

from backend.config import DEVICE


class ImageEncoder:
    def __init__(self):
        self.device = torch.device(
            DEVICE if DEVICE == "cuda" and torch.cuda.is_available()
            else "cpu"
        )

        self.weights = ResNet50_Weights.DEFAULT
        self.preprocess = self.weights.transforms()

        self.model = models.resnet50(weights=self.weights)
        self.model.fc = torch.nn.Identity()
        self.model.eval().to(self.device)

    def encode(self, image: Image.Image):
        tensor = self.preprocess(image.convert("RGB"))
        tensor = tensor.unsqueeze(0).to(self.device)

        with torch.inference_mode():
            embedding = self.model(tensor)
            embedding = torch.nn.functional.normalize(
                embedding.float(), p=2, dim=1
            )

        return embedding.cpu().numpy()