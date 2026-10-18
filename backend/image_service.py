
from pathlib import Path

import requests
from fastapi import HTTPException
from fastapi.responses import FileResponse

from backend.config import CACHE_DIR
from backend.search import ImageSearch


def serve_image(image_id: int, search: ImageSearch):
    position = search.id_to_position.get(image_id)

    if position is None:
        raise HTTPException(status_code=404, detail="Image not found")

    file_id = str(search.drive_file_ids[position])
    cache_path = CACHE_DIR / f"{image_id}.jpg"

    # Return the cached image if it already exists.
    if cache_path.exists():
        return FileResponse(cache_path, media_type="image/jpeg")

    # Fetch the image from Google Drive on demand.
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

        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_path.write_bytes(response.content)

        return FileResponse(cache_path, media_type=content_type)

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=503,
            detail="Image unavailable online and not cached locally",
        ) from exc
