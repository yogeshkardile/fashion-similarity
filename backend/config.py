
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"

INDEX_PATH = ARTIFACTS_DIR / "fashion_resnet50.faiss"
MAPPING_PATH = ARTIFACTS_DIR / "fashion_mapping_drive.npz"

CACHE_DIR = PROJECT_ROOT / "cache" / "images"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

DEVICE = "cuda"
EMBEDDING_DIM = 2048
