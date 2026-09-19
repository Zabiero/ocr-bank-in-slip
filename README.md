# Slip Scanner

> **Note:** this repo also contains [`web/`](web/README.md), a separate,
> self-contained client-side app for batch-scanning Malaysian bank-in slips
> into an editable, exportable table (on-device OCR, no server, no Google
> Sheets). See `web/README.md` for that app's setup and docs. The rest of
> this README describes the original single-slip-to-Google-Sheets tool
> below.

A small, clean web app that reads a photo of a bank transfer slip / payment
receipt, extracts the details (amount, date, sender/receiver, reference
number, etc.), auto-categorizes the transaction, and saves it to a Google
Sheet after you confirm it looks right.

- **Backend:** FastAPI + Claude (vision) for extraction and categorization
- **Frontend:** plain HTML/CSS/JS, no build step
- **Storage:** Google Sheets (via a service account)

## How it works

1. Upload or drag in a photo/screenshot of a slip.
2. Claude reads the image and returns structured fields (date, amount,
   currency, sender/receiver, bank, reference number, description) plus a
   best-guess **category** (Food & Dining, Transport, Utilities, Transfer,
   Salary & Income, ...).
3. You review the extracted values in an editable form and fix anything
   that's wrong.
4. On save, a row is appended to your Google Sheet.

Nothing is written to the sheet until you click **Save** — extraction alone
never touches your spreadsheet.

## Setup

### 1. Install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Get an Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com/) and
copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set `ANTHROPIC_API_KEY` in `.env`.

### 3. Create a Google service account with Sheets access

1. In the [Google Cloud Console](https://console.cloud.google.com/), create
   (or reuse) a project and enable the **Google Sheets API**.
2. Create a **Service Account**, then create a JSON key for it and download
   it as `service_account.json` in the project root (or point
   `GOOGLE_SERVICE_ACCOUNT_FILE` in `.env` at wherever you saved it).
3. Open the Google Sheet you want to save to and **share** it (Editor
   access) with the service account's email address — it looks like
   `something@your-project.iam.gserviceaccount.com` and is in the JSON key
   file.
4. Copy the spreadsheet ID from its URL
   (`https://docs.google.com/spreadsheets/d/<THIS_PART>/edit`) into
   `GOOGLE_SHEET_ID` in `.env`.
5. Optionally set `GOOGLE_SHEET_WORKSHEET` to the tab name you want rows
   appended to (default `Slips`). The tab and a header row are created
   automatically if they don't exist yet.

### 4. Run it

```bash
uvicorn app.main:app --reload
```

Open [http://localhost:8000](http://localhost:8000).

## Categories

The fixed category list lives in `app/config.py` (`CATEGORIES`) — edit it to
match how you want spending grouped; Claude will pick from whatever list is
there.

## Project layout

```
app/
  main.py        FastAPI app + routes
  extraction.py  Claude vision call -> structured slip fields
  sheets.py      Google Sheets writer
  config.py      env vars, categories, sheet header row
static/
  index.html     upload + review UI
  styles.css
  app.js
```
