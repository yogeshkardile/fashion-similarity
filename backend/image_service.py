from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import FileResponse
import requests

from backend.config import CACHE_DIR
from backend.search import ImageSearch


def serve_image(image_id: int | str, search: ImageSearch):
  # Parse integer ID if possible
  try:
    lookup_id = int(image_id)
  except (ValueError, TypeError):
    lookup_id = str(image_id)

  position = search.id_to_position.get(lookup_id)
  if position is None and isinstance(lookup_id, str):
    position = search.id_to_position.get(lookup_id.strip())

  if position is None:
    raise HTTPException(status_code=404, detail="Image not found")

  raw_file_id = search.drive_file_ids[position]
  file_id = (
      raw_file_id.decode("utf-8")
      if isinstance(raw_file_id, bytes)
      else str(
          raw_file_id.item() if hasattr(raw_file_id, "item") else raw_file_id
      )
  )

  cache_path = Path(CACHE_DIR) / f"{image_id}.jpg"

  # Return the cached image if it already exists.
  if cache_path.exists():
    return FileResponse(cache_path, media_type="image/jpeg")

  # Fetch the image from Google Drive thumbnail endpoint on demand.
  url = f"https://drive.google.com/thumbnail?id={file_id}&sz=w800"

  try:
    response = requests.get(url, timeout=20)
    response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    if not content_type.startswith("image/"):
      raise HTTPException(
          status_code=502,
          detail="Google Drive did not return an image",
      )

    Path(CACHE_DIR).mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(response.content)

    return FileResponse(cache_path, media_type=content_type)

  except requests.RequestException as exc:
    raise HTTPException(
        status_code=503,
        detail="Image unavailable online and not cached locally",
    ) from exc