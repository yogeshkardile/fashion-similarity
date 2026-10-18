# FashionFinder

FashionFinder is a visual fashion-similarity search application. Upload a clothing image to retrieve visually similar items from a collection of **46,994 images**.

The project uses a pretrained ResNet-50 model to create image embeddings and a FAISS index to search for nearest neighbors. Original images stay in Google Drive and are fetched on demand through the FastAPI backend. Images requested successfully are cached locally for later reuse.

## Features

- Upload an image using file selection or drag and drop.
- Find visually similar fashion images using vector similarity search.
- Choose how many results to return.
- Display similarity scores for returned images.
- Fetch result images from Google Drive on demand.
- Cache retrieved images locally to reduce repeated network requests.
- Serve the frontend locally and communicate with the backend through a REST API.

## Architecture

FashionFinder uses a frontend, a FastAPI backend, a ResNet50 feature extractor, and a FAISS index to find visually similar fashion images.

| Component | Responsibility |
|---|---|
| Frontend (HTML, CSS, JavaScript) | Upload an image and display similar results |
| FastAPI backend | Handle search requests and serve images |
| Pillow | Validate and process uploaded images |
| ResNet50 | Extract 2048-dimensional image embeddings |
| FAISS | Search for visually similar images |
| Image mapping | Map FAISS results to image IDs and Google Drive file IDs |
| Image service | Fetch images from Google Drive on demand |
| Local image cache | Store fetched images for subsequent requests |

### Search Flow

1. The user uploads an image through the frontend.
2. FastAPI receives the image and validates it.
3. ResNet50 extracts its feature embedding.
4. FAISS searches the existing index for similar images.
5. The backend returns the top matching image IDs and similarity scores.
6. The frontend requests the matching images from the image endpoint.
7. The image service returns cached images or fetches uncached images from Google Drive and caches them.

**Note:** Cached images can be reused locally. Images that have not been cached require an internet connection to fetch.

## Project structure

```text
fashion-similarity/
├── .venv/                         # Local Python virtual environment (not committed)
├── artifacts/
│   ├── fashion_resnet50.faiss     # Precomputed FAISS vector index
│   ├── fashion_mapping.npz        # Original mapping artifact
│   └── fashion_mapping_drive.npz  # Mapping of image IDs to Drive file IDs and paths
├── backend/
│   ├── __init__.py                # Marks backend as a Python package
│   ├── config.py                  # Project paths, artifact paths, cache path, model settings
│   ├── image_service.py           # On-demand image fetching and local image caching
│   ├── main.py                    # FastAPI app, lifecycle, CORS, health and API routes
│   ├── model.py                   # ResNet-50 image encoder and embedding generation
│   └── search.py                  # Loads FAISS and mapping; performs top-K similarity search
├── cache/
│   └── images/                    # Downloaded-on-demand image cache (generated at runtime)
├── frontend/
│   ├── index.html                 # Frontend page structure
│   ├── script.js                  # Upload interactions, API requests, result rendering
│   └── style.css                  # Layout, colors, upload area, result cards, responsive styling
├── notebooks/                     # Notebooks for experiments or dataset preparation
├── .gitignore                     # Files excluded from version control
└── requirements.txt               # Python dependencies
```

## What each file does

| File | Responsibility |
|---|---|
| `backend/config.py` | Defines project paths, FAISS index path, Drive mapping path, cache directory, device setting, and embedding dimension. |
| `backend/model.py` | Loads pretrained ResNet-50, prepares images, and generates image embeddings for queries. |
| `backend/search.py` | Loads the precomputed FAISS index and `fashion_mapping_drive.npz`; returns the nearest image IDs and similarity scores. |
| `backend/image_service.py` | Resolves an image ID to its Drive file ID, returns cached images when present, and fetches/cache-misses from Google Drive. |
| `backend/main.py` | Creates the FastAPI application, initializes the encoder and search engine, configures CORS, and defines the HTTP endpoints. |
| `frontend/index.html` | Defines the upload area, image preview, search controls, status messages, and results container. |
| `frontend/style.css` | Styles the interface and adapts it for desktop, tablet, and mobile. |
| `frontend/script.js` | Handles file selection and drag-and-drop, preview, `/search` requests, and loading result images from `/images/{image_id}`. |
| `requirements.txt` | Lists the Python packages required to run the backend. |
| `artifacts/fashion_resnet50.faiss` | Stores the precomputed FAISS index. Keep it aligned with the mapping used by the backend. |
| `artifacts/fashion_mapping_drive.npz` | Stores `image_ids`, `drive_file_ids`, and `image_paths` in the same order as the indexed vectors. |
| `cache/images/` | Stores images retrieved on demand. It can be regenerated as images are requested again. |
| `notebooks/` | Holds optional notebooks used for dataset preparation and experiments. |

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/` | Confirms that the API is running. |
| `GET` | `/health` | Returns API status and the number of indexed images. |
| `POST` | `/search?top_k=10` | Accepts an uploaded image and returns the top-K similar images. |
| `GET` | `/images/{image_id}` | Serves an image from cache or fetches it from Google Drive on demand. |
| `GET` | `/docs` | Opens FastAPI's interactive API documentation. |

### Example search response

```json
{
  "query_filename": "query.jpg",
  "results": [
    {
      "image_id": 49,
      "image_path": "Dresses/10016.jpg",
      "drive_file_id": "GOOGLE_DRIVE_FILE_ID",
      "similarity": 1.0
    }
  ]
}
```

The values above illustrate the response format; the image ID, file ID, and similarity depend on the actual query.

## Requirements

- Python compatible with the packages pinned in `requirements.txt`
- Access to the precomputed files in `artifacts/`
- Internet access for images that have not yet been cached
- Google Drive images accessible to the backend using the configured image-fetching method

## Run locally

Run commands from the project root.

### 1. Activate the virtual environment

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
python -m pip install -r requirements.txt
```

If `requests` is not included in `requirements.txt`, add it there before installing.

### 3. Start the backend

```powershell
python -m uvicorn backend.main:app --reload
```

The API should be available at:

- API: http://127.0.0.1:8000
- Interactive docs: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

### 4. Open the frontend

Open `frontend/index.html` using a local web server, for example the IDE's built-in preview server or VS Code Live Server. The current frontend JavaScript uses:

```javascript
const API_URL = "http://127.0.0.1:8000";
```

If the frontend is served from a different origin, add that origin to the CORS configuration in `backend/main.py`.

## Artifacts and image caching

- **Do not rebuild the FAISS index** unless you intentionally regenerate the dataset embeddings and mapping together.
- `fashion_mapping_drive.npz` must match the vector order in `fashion_resnet50.faiss`.
- Keep `image_ids`, `drive_file_ids`, and `image_paths` aligned by position.
- `cache/images/` contains only images that have been requested and successfully fetched.
- Cached images can be served without internet access, but images never cached still require network access.
- Cache contents are runtime data; they generally do not need to be committed to Git.
- Google Drive thumbnail/download behavior may depend on file sharing settings and Drive limits.

## Deployment notes

1. Deploy the FastAPI backend to a host that supports the model and FAISS dependencies.
2. Make the artifact files available to the backend or download them during deployment from a trusted artifact store.
3. Configure the frontend's `API_URL` to point to the deployed backend.
4. Configure CORS to allow the deployed frontend origin.
5. Ensure the backend has write permission for its cache directory.
6. Confirm the hosting platform has enough disk space and memory for the FAISS index and model.
7. Test image fetching, cache hits, and cache misses after deployment.

A local disk cache is usually ephemeral on some hosting platforms and may be cleared when an instance restarts. For persistent production caching, use a persistent volume or object storage supported by the deployment platform.

## Troubleshooting

### API starts, but image search fails

- Check `/health` and `/docs`.
- Confirm both artifact files exist under `artifacts/`.
- Ensure the mapping count matches the FAISS index size.
- Check the backend terminal for the complete traceback.

### Result cards appear, but images do not load

- Open `/images/<image_id>` directly in the browser.
- Check that the image ID exists in the mapping.
- Check internet access and Google Drive file access.
- Inspect the backend terminal for HTTP errors.

### CORS error in the browser

Add the exact frontend origin to `allow_origins` in `backend/main.py`, then restart the backend.

### Offline mode

Only images already saved in `cache/images/` can be displayed offline. The initial retrieval of an uncached image requires internet access.

## Technology stack

- **Frontend:** HTML, CSS, JavaScript
- **API:** FastAPI, Uvicorn
- **Image processing:** Pillow
- **Embeddings:** PyTorch and torchvision with pretrained ResNet-50
- **Vector search:** FAISS
- **Image source:** Google Drive
- **Caching:** Local filesystem

## Project status

The project currently supports local image upload, embedding-based similarity search, and on-demand result-image serving with local caching. Deployment configuration and persistent cache behavior should be verified for the target hosting platform before production use.
