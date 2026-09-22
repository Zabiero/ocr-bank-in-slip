FROM python:3.11-slim

WORKDIR /app

# libgl1/libglib2.0-0: required by OpenCV, a PaddleOCR dependency.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

# Most hosts (Render, Railway, Fly.io, etc.) inject a PORT env var and expect
# the app to listen on it; default to 8000 for a plain `docker run` on a VPS.
ENV PORT=8000
EXPOSE 8000
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT}
