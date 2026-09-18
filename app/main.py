from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.config import CATEGORIES
from app.extraction import extract_slip
from app.sheets import append_slip

app = FastAPI(title="Bank Slip Extractor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

_ALLOWED_TYPES = {
    "image/png": "image/png",
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/webp": "image/webp",
    "image/gif": "image/gif",
}

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


class SlipFields(BaseModel):
    date: str = ""
    time: str = ""
    amount: float
    currency: str = ""
    transaction_type: str = ""
    sender_name: str = ""
    sender_account: str = ""
    receiver_name: str = ""
    receiver_account: str = ""
    bank_name: str = ""
    reference_number: str = ""
    description: str = ""
    category: str = ""


@app.get("/api/categories")
def get_categories():
    return {"categories": CATEGORIES}


@app.post("/api/extract")
async def api_extract(file: UploadFile = File(...)):
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload a PNG, JPEG, WEBP, or GIF image.",
        )

    image_bytes = await file.read()
    if len(image_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image is larger than 10 MB.")
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        fields = extract_slip(image_bytes, _ALLOWED_TYPES[file.content_type])
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return fields


@app.post("/api/save")
def api_save(fields: SlipFields):
    try:
        append_slip(fields.model_dump())
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"status": "ok"}


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")
