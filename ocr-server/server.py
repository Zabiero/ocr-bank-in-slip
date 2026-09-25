"""PaddleOCR server for the Bank-In Slip Scanner web app (see ../web).

Run this alongside the web app to use PaddleOCR as an OCR engine option
instead of the bundled Tesseract.js or Google Cloud Vision. By default this
is meant to run on your own machine, with the web app posting images to it
over localhost - no image data goes anywhere else. It can also be deployed
somewhere internet-reachable (see ocr-server/README.md) so a phone away
from your local network can use it too; set PADDLEOCR_API_KEY in that case
so it isn't left open to anyone who finds the URL.
"""

import io
import os
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

# Set this env var before running to require an API key on every request -
# needed if you deploy this server somewhere reachable from the internet
# (e.g. to use it from your phone away from your local network) instead of
# running it purely on localhost. Leave unset for local-only use: with no
# key configured, the server accepts requests unauthenticated, same as
# before this existed.
_REQUIRED_API_KEY = os.environ.get("PADDLEOCR_API_KEY")

# enable_mkldnn=False works around a NotImplementedError
# ("ConvertPirAttribute2RuntimeAttribute ... not support") that some Windows
# CPU builds of PaddlePaddle 3.x hit with its newer PIR execution engine. If
# you still hit that error with this disabled, downgrade instead:
#   pip install paddlepaddle==2.6.2
from paddleocr import PaddleOCR

app = FastAPI(title="Bank-In Slip Scanner - PaddleOCR server")

# A permissive CORS policy is fine here since the actual protection against
# unauthorized use is the API key check below (when PADDLEOCR_API_KEY is
# set), not CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


def _require_api_key(x_api_key: Optional[str]) -> None:
    if _REQUIRED_API_KEY and x_api_key != _REQUIRED_API_KEY:
        raise HTTPException(401, "Missing or invalid X-API-Key header")


# Loaded once at startup - PaddleOCR initialization is slow (and downloads
# model files on first run); individual requests are fast once it's ready.
#
# Document orientation classification and unwarping are extra whole-page
# neural-net passes meant for photos of curled/skewed paper documents; they
# add real CPU time and aren't needed for a flat mobile screenshot or a
# slip photo our own preprocessing has already EXIF-rotated. Text-line
# orientation is left enabled - it operates per detected text region and
# testing found disabling it broke recognition of small/faint text, which
# is the whole reason to use PaddleOCR here.
#
# text_detection/recognition_model_name pinned to the "small" PP-OCRv6
# variants instead of the ("medium") default: on Render's free tier
# (512MB RAM hard limit), the default models pushed usage to ~487MB at
# idle, and any real request on top of that triggered an OOM kill ->
# crash-restart loop. Small models are ~30MB combined vs. ~134MB for
# medium, comfortably fitting under 512MB with headroom for inference.
_ocr = PaddleOCR(
    enable_mkldnn=False,
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    text_detection_model_name="PP-OCRv6_small_det",
    text_recognition_model_name="PP-OCRv6_small_rec",
)


@app.post("/ocr")
async def ocr(file: UploadFile = File(...), x_api_key: Optional[str] = Header(default=None)):
    _require_api_key(x_api_key)

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
