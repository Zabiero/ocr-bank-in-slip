# PaddleOCR server (optional)

An optional OCR backend for [`web/`](../web/README.md), used when you select
**PaddleOCR** as the OCR engine in the app's Settings. Runs locally by
default; can also be deployed as a real internet-reachable API (see
[Deploying publicly](#deploying-publicly) below) if you want to use it from
a phone that isn't on the same network as the machine running it.

Why this exists: PaddleOCR's text detector catches small, faint, or
secondary text (e.g. a light-gray timestamp on a mobile "share receipt"
screenshot) that the bundled Tesseract.js engine sometimes misses entirely.
The trade-off is that PaddleOCR is Python-only — it can't run inside the
browser the way Tesseract.js does — so it needs this small server instead.
Run it locally and everything stays on your machine: the web app posts the
slip image to `http://localhost:8000` on the same computer, and nothing is
sent anywhere else.

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

`POST /ocr` — multipart form field `file` (an image), header `X-API-Key`
(only required if `PADDLEOCR_API_KEY` is set — see
[Deploying publicly](#deploying-publicly)). Returns:

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
model) has finished loading. Not protected by the API key, since hosts
typically need an open health check to know the server is alive.

## Deploying publicly

Running this on `localhost` only works when your phone is on the same WiFi
network as the machine running the server. To use PaddleOCR from anywhere,
deploy it somewhere internet-reachable instead:

1. **Set an API key first.** With no `PADDLEOCR_API_KEY` set, `/ocr` accepts
   any request — fine on localhost, not fine on the public internet, since
   anyone who finds the URL could use your server's compute for free.
   Generate a random string and set it as an environment variable on
   whatever host you use (e.g. `PADDLEOCR_API_KEY=<a long random string>`).
2. **Pick a host.** A [`Dockerfile`](Dockerfile) is included, so any
   container-based host works:
   - A small always-on VPS (DigitalOcean, Hetzner, etc., roughly
     $4-6/month) is the most predictable option — no cold starts, dedicated
     RAM for PaddleOCR's models. Build and run the image, or install
     dependencies directly and run `uvicorn` behind a process manager.
   - A free-tier PaaS (Render, Railway, Fly.io) costs nothing but typically
     sleeps the server when idle — expect a 30-60+ second delay on the
     first scan after a quiet period, and check the free tier's RAM limit
     is enough for PaddleOCR's models (at least ~1GB recommended).
3. **Point the app at it.** In the app's Settings, set **PaddleOCR server
   URL** to the deployed URL (e.g. `https://your-app.example.com`) and
   **API key** to the same value as `PADDLEOCR_API_KEY`.
