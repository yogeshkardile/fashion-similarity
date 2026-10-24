import io
import numpy as np
import onnxruntime as ort
from PIL import Image


class ImageEncoder:

  def __init__(self, model_path: str = "artifacts/resnet50.onnx"):
    self.session = ort.InferenceSession(
        model_path, providers=["CPUExecutionProvider"]
    )
    self.input_name = self.session.get_inputs()[0].name

  def get_image_embedding(self, image_input) -> np.ndarray:
    # 1. Check if input is bytes or PIL Image
    if isinstance(image_input, bytes):
      img = Image.open(io.BytesIO(image_input)).convert("RGB")
    elif isinstance(image_input, Image.Image):
      img = image_input.convert("RGB")
    else:
      img = Image.open(image_input).convert("RGB")

    # 2. Resize & normalize
    img = img.resize((224, 224))
    img_data = np.array(img, dtype=np.float32).transpose(2, 0, 1) / 255.0

    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)
    img_data = (img_data - mean) / std
    img_data = np.expand_dims(img_data, axis=0).astype(np.float32)

    # 3. Run ONNX Inference
    outputs = self.session.run(None, {self.input_name: img_data})
    embedding = outputs[0].flatten()

    norm = np.linalg.norm(embedding)
    return embedding / norm if norm > 0 else embedding

  # Map 'encode' to 'get_image_embedding'
  encode = get_image_embedding