from contextlib import asynccontextmanager
from io import BytesIO

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from PIL import Image, UnidentifiedImageError

from backend.model import ImageEncoder
from backend.search import ImageSearch
from fastapi.middleware.cors import CORSMiddleware
from backend.image_service import serve_image


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.encoder = ImageEncoder()
    app.state.search = ImageSearch()
    yield


app = FastAPI(
    title="Fashion Similarity API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:63342",
        "http://127.0.0.1:63342",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Fashion Similarity API"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "indexed_images": app.state.search.index.ntotal,
    }


@app.post("/search")
async def search_engine(
    file: UploadFile = File(...),
    top_k: int = Query(default=10, ge=1, le=50),
):
    contents = await file.read(10 * 1024 * 1024 + 1)

    if not contents:
        raise HTTPException(400, "Empty file")

    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image exceeds 10 MB")

    try:
        with Image.open(BytesIO(contents)) as image:
            image.verify()

        with Image.open(BytesIO(contents)) as image:
            embedding = app.state.encoder.encode(image)

    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(400, "Invalid image")

    results = app.state.search.search(embedding, top_k)

    return {
        "query_filename": file.filename,
        "results": results,
    }

@app.get("/images/{image_id}")
def get_image(image_id: int):
    return serve_image(image_id, app.state.search)
