# PaddleOCR server (optional, local-only)

An optional local OCR backend for [`web/`](../web/README.md), used when you
select **PaddleOCR** as the OCR engine in the app's Settings.

Why this exists: PaddleOCR's text detector catches small, faint, or
secondary text (e.g. a light-gray timestamp on a mobile "share receipt"
screenshot) that the bundled Tesseract.js engine sometimes misses entirely.
The trade-off is that PaddleOCR is Python-only — it can't run inside the
browser the way Tesseract.js does — so it needs this small local server
instead. Everything still stays on your machine: the web app posts the slip
image to `http://localhost:8000` on the same computer, and nothing is sent
anywhere else.

## Setup

Requires Python 3.9+.

```bash
cd ocr-server
python -m venv venv
```

Activate the virtual environment:

```bash
venv\Scripts\activate        # Windows (Command Prompt)
source venv/bin/activate     # macOS/Linux
```

Install dependencies (downloads ~200MB+ for PaddlePaddle itself):

```bash
pip install -r requirements.txt
```

## Run

```bash
uvicorn server:app --port 8000
```

The **first** request after starting the server downloads PaddleOCR's model
files (a few hundred MB, needs internet access to Hugging Face, ModelScope,
AIStudio, or Baidu BOS) and takes noticeably longer; every request after
that is fast, using the cached models.

Leave this running in its own terminal window alongside `npm run dev` in
`web/`. Then, in the app, open **Settings → OCR engine** and choose
**PaddleOCR**, with the server URL set to `http://localhost:8000` (the
default).

## Troubleshooting

- **`NotImplementedError: ... ConvertPirAttribute2RuntimeAttribute ...`** —
  a known incompatibility between PaddlePaddle 3.x's newer execution engine
  and oneDNN CPU acceleration on some Windows setups. `server.py` already
  disables oneDNN (`enable_mkldnn=False`) to avoid this. If you still hit it,
  downgrade instead: `pip install paddlepaddle==2.6.2`.
- **Model download fails or hangs** — PaddleOCR needs to reach one of
  Hugging Face / ModelScope / AIStudio / Baidu BOS on first run; check that
  your network or corporate firewall allows at least one of those.
- **The app says "Could not reach the PaddleOCR server"** — make sure
  `uvicorn server:app --port 8000` is still running, and that the server URL
  in the app's Settings matches the port you started it on.

## API

`POST /ocr` — multipart form field `file` (an image). Returns:

```json
{
  "text": "Reference ID\n31 Jul 2026, 12:42 PM\n960386438M\n...",
  "confidence": 92.4,
  "lines": [
    { "text": "Reference ID", "confidence": 91.2, "bbox": { "x0": 22, "y0": 73, "x1": 180, "y1": 102 } }
  ]
}
```

`GET /health` — returns `{"status": "ok"}` once the server (and PaddleOCR
model) has finished loading.
