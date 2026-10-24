FROM python:3.10-slim

# Install system libraries needed by FAISS and Pillow
RUN apt-get update && apt-get install -y \
    build-essential \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install without pip caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application artifacts and code
COPY artifacts/ ./artifacts/
COPY backend/ ./backend/

# Create runtime caching directory
RUN mkdir -p cache/images

EXPOSE 8000

# Enforce 1 worker process to avoid doubling RAM usage
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]