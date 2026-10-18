
import numpy as np
import faiss

from backend.config import INDEX_PATH, MAPPING_PATH


class ImageSearch:
    def __init__(self):
        self.index = faiss.read_index(str(INDEX_PATH))

        with np.load(MAPPING_PATH, allow_pickle=False) as data:
            self.image_ids = data["image_ids"]
            self.drive_file_ids = data["drive_file_ids"]
            self.image_paths = data["image_paths"]

        if not (
            len(self.image_ids)
            == len(self.drive_file_ids)
            == len(self.image_paths)
            == self.index.ntotal
        ):
            raise ValueError(
                "Mapping size does not match the FAISS index."
            )

        self.id_to_position = {
            int(image_id): position
            for position, image_id in enumerate(self.image_ids)
        }

    def search(self, query_embedding, top_k=10):
        query_embedding = np.asarray(
            query_embedding, dtype=np.float32
        ).reshape(1, -1)

        scores, indices = self.index.search(query_embedding, top_k)

        results = []

        for score, position in zip(scores[0], indices[0]):
            if position < 0:
                continue

            results.append({
                "image_id": int(self.image_ids[position]),
                "image_path": str(self.image_paths[position]),
                "drive_file_id": str(self.drive_file_ids[position]),
                "similarity": float(score),
            })

        return results
