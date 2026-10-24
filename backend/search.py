import faiss
import numpy as np


class ImageSearch:

  def __init__(
      self,
      index_path: str = "artifacts/fashion_resnet50.faiss",
      mapping_path: str = "artifacts/fashion_mapping_drive.npz",
  ):
    self.index = faiss.read_index(index_path)
    mapping = np.load(mapping_path, allow_pickle=True)

    self.image_ids = mapping["image_ids"]
    self.drive_file_ids = mapping["drive_file_ids"]

    self.id_to_position = {}
    for pos, raw_id in enumerate(self.image_ids):
      clean_id = (
          raw_id.decode("utf-8")
          if isinstance(raw_id, bytes)
          else (raw_id.item() if hasattr(raw_id, "item") else raw_id)
      )
      try:
        self.id_to_position[int(clean_id)] = pos
      except (ValueError, TypeError):
        pass
      self.id_to_position[str(clean_id)] = pos
      self.id_to_position[pos] = pos

  def search(self, embedding_vector: np.ndarray, top_k: int = 10):
    query_vec = np.ascontiguousarray(
        embedding_vector.reshape(1, -1), dtype=np.float32
    )
    distances, indices = self.index.search(query_vec, top_k)

    results = []
    for distance, idx in zip(distances[0], indices[0]):
      if idx != -1 and idx < len(self.image_ids):
        raw_id = self.image_ids[idx]
        img_id = (
            raw_id.decode("utf-8")
            if isinstance(raw_id, bytes)
            else (raw_id.item() if hasattr(raw_id, "item") else raw_id)
        )
        try:
          img_id = int(img_id)
        except (ValueError, TypeError):
          pass

        # Calculate a 0-100% similarity score based on distance
        # For L2 distance: lower distance = higher similarity
        dist_val = float(distance)
        similarity_pct = max(0, min(100, int((1 - dist_val / 2.0) * 100)))

        results.append({
            "id": img_id,
            "image_id": img_id,
            "score": dist_val,
            "distance": dist_val,
            "similarity": similarity_pct,
            "match": f"{similarity_pct}% match",
        })

    return results