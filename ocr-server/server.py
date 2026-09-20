"""Local PaddleOCR server for the Bank-In Slip Scanner web app (see ../web).

Run this alongside the web app to use PaddleOCR as an OCR engine option
instead of the bundled Tesseract.js or Google Cloud Vision. Everything stays
on this machine: the web app posts an image to this server over localhost,
and no image data goes anywhere else.
"""

import io

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

# enable_mkldnn=False works around a NotImplementedError
# ("ConvertPirAttribute2RuntimeAttribute ... not support") that some Windows
# CPU builds of PaddlePaddle 3.x hit with its newer PIR execution engine. If
# you still hit that error with this disabled, downgrade instead:
#   pip install paddlepaddle==2.6.2
from paddleocr import PaddleOCR

app = FastAPI(title="Bank-In Slip Scanner - PaddleOCR server")

# This server is meant for local-only use (the web app running on the same
# machine) and is never exposed to the internet, so a permissive CORS policy
# is fine here - do not deploy this server publicly as-is.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

# Loaded once at startup - PaddleOCR initialization is slow (and downloads
# model files on first run); individual requests are fast once it's ready.
_ocr = PaddleOCR(lang="en", enable_mkldnn=False)


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Expected an image file")

    image_bytes = await file.read()
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise HTTPException(400, f"Could not decode image: {exc}") from exc

    result = _ocr.predict(np.array(image))
    if not result:
        return {"text": "", "confidence": 0, "lines": []}

    res = result[0]
    texts = res["rec_texts"]
    scores = res["rec_scores"]
    boxes = res["rec_boxes"]

    lines = [
        {
            "text": text,
            "confidence": float(score) * 100,
            "bbox": {
                "x0": int(box[0]),
                "y0": int(box[1]),
                "x1": int(box[2]),
                "y1": int(box[3]),
            },
        }
        for text, score, box in zip(texts, scores, boxes)
    ]

    overall_confidence = float(sum(scores) / len(scores) * 100) if len(scores) else 0

    return {
        "text": "\n".join(texts),
        "confidence": overall_confidence,
        "lines": lines,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
