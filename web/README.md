# Bank-In Slip Scanner

A mobile-first web app that reads Malaysian bank-in slips (deposit/transfer
receipts) — by camera or file upload — and extracts date, time, amount,
reference number and bank name into an editable, exportable table.

Everything runs **client-side**: OCR, image cleanup, parsing and storage all
happen in the browser. No backend, no server-side image storage. See
[Privacy](#privacy) below.

## Architecture

```
web/
  src/
    types.ts                 Shared types: SlipRecord, ParsedSlip, AppSettings, ...
    processFile.ts            Orchestrates one file: preprocess -> OCR -> parse -> SlipRecord
    duplicateDetection.ts     Same reference no. + amount => duplicate warning

    imageProcessing/
      preprocess.ts            PDF/HEIC decoding, EXIF auto-rotate, auto-crop,
                                grayscale + contrast stretch (Canvas API)

    ocr/                       Swappable OCR backends behind one interface
      engine.ts                 OcrEngine: extractText(canvas) -> {text, confidence, boxes}
      tesseractEngine.ts         Default: Tesseract.js, fully on-device & offline
      cloudVisionEngine.ts       Optional: Google Cloud Vision (user's own API key)
      index.ts                   getOcrEngine(settings) factory

    parsing/                  Pure text -> structured fields (OCR-agnostic, unit tested)
      parseSlip.ts               Combines the parsers below + confidence/status rules
      dateParsing.ts             DD/MM/YYYY, ISO, "12 Sep 2026"/"12 Mac 2026", 2-digit years
      timeParsing.ts             24h/12h -> normalized 12-hour hh:mm:ss AM/PM
      amountParsing.ts           Currency prefixes, thousand separators, OCR digit confusions
      referenceParsing.ts        Reference/transaction-ID labels (EN + BM)
      maskAccountNumbers.ts      Masks account numbers found near an "Account No" label
      banks.ts                   Configurable bank name + alias list
      __tests__/parseSlip.test.ts  5+ realistic sample slips, one test per bank/edge case

    storage/
      db.ts                     IndexedDB: slips persist across refresh
      settings.ts                localStorage: app settings (date mode, OCR engine, ...)

    export/                    CSV / Excel (SheetJS) / clipboard (TSV), all from one row shape

    components/                CameraCapture, UploadDropzone, ResultsTable, Filters,
                                TotalsFooter, SettingsPanel, ProcessingQueue, ...
    hooks/                      useSlips (IndexedDB-backed state), useSettings
    App.tsx                    Wires it all together
```

The parsing module has **no knowledge of OCR or images** — it's a pure
`string -> ParsedSlip` function, which is what makes it unit-testable and
lets you swap OCR engines without touching a single regex.

## Setup & run

Requires Node 18+.

```bash
cd web
npm install
npm run dev       # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
npm test           # run the parsing unit tests (vitest)
npm run test:watch
```

No `.env` or API key is required to run the app — the default OCR engine
(Tesseract.js) ships with the app and needs no network access.

## OCR engines

Selected in **Settings**, both implement the same `OcrEngine` interface
(`src/ocr/engine.ts`):

- **Tesseract.js (default)** — runs entirely on-device, in a Web Worker.
  The worker script, WASM core and English+Malay trained data are bundled
  under `public/tesseract/` (see `src/ocr/tesseractEngine.ts`) instead of
  being fetched from tesseract.js's default CDN, so this engine has **zero
  network dependency** and works fully offline, including on restrictive
  corporate networks.
- **Google Cloud Vision (optional)** — more accurate on low-quality photos,
  but sends the slip image to Google's API using an API key you supply
  yourself in Settings. The app shows a clear warning before you can enable
  it, and the key is stored only in `localStorage`.

To add another engine (e.g. AWS Textract or Azure Document Intelligence),
implement `OcrEngine` in a new file under `src/ocr/` and wire it into
`getOcrEngine()` in `src/ocr/index.ts` — nothing else in the app needs to
change.

## Adding a new bank

Edit `src/parsing/banks.ts` and append an entry to the `BANKS` array:

```ts
{
  name: 'Example Bank',
  aliases: ['example bank', 'examplebank', 'ebank2u'], // lowercase, as seen on real slips/headers
},
```

`detectBank()` matches aliases as case-insensitive substrings against the
full OCR text, and picks the longest matching alias if more than one bank
matches. If nothing matches, the bank is reported as `"Unknown"` with 0
confidence — it is never guessed.

## Adding a new date format

Date parsing lives in `src/parsing/dateParsing.ts` and is pattern-based:

1. Add a new entry to the `PATTERNS` array with a `regex` and a `build()`
   function that turns a regex match into `{ day, month, year, ambiguous }`.
2. If the format includes month names (e.g. another language), add them to
   the `MONTHS` map at the top of the file — `MONTH_NAME_PATTERN` is built
   from its keys automatically.
3. Add a sample slip using the new format to
   `src/parsing/__tests__/parseSlip.test.ts` (or a focused test in a new
   `dateParsing.test.ts`) and run `npm test`.

Numeric `DD/MM` vs `MM/DD` ambiguity (when both parts are ≤ 12) is resolved
using the **"Ambiguous dates"** setting (day-first by default, matching
Malaysian convention) — this is a deliberate, user-controlled choice, never
a silent guess.

## Confidence & review rules

Every extracted field carries a 0–100 confidence score (`ParsedField<T>` in
`types.ts`):

- Value found with an explicit label (e.g. "Date:", "Jumlah:") → high
  confidence (~95).
- Value found without a label (bare pattern match elsewhere on the slip) →
  lower confidence.
- OCR digit confusions corrected in an amount (O↔0, l/I↔1, S↔5, B↔8) →
  confidence reduced further.
- Not found at all → `value: null`, confidence `0`. **The app never
  fabricates a value** — a blank, red cell always means "not found", never
  a guess.

In the table, any present field below 80% confidence is highlighted yellow
("Needs review"); a missing required field is highlighted red. Time is the
one exception — plenty of valid slips (a formal bank payment advice, for
instance) never state a time of day at all, so a missing time shows as a
neutral "N/A" instead and doesn't count against the slip. A slip's overall
**Status** is `OK` only when every other required field (date, amount,
reference no., bank) is present and ≥ 80% confident, and time - if it was
found at all - is also ≥ 80% confident.

Click any cell to correct it — a manual edit is always treated as 100%
confident.

## Privacy

- The default OCR engine and all image preprocessing run **on-device**;
  slip photos never leave the browser.
- Slips and settings are stored only in this browser, via **IndexedDB**
  (`bank-slip-ocr` database) and `localStorage`. Nothing is sent to any
  server by this app.
- If you enable **Cloud Vision** in Settings, each slip image is sent to
  Google's Vision API using your own API key — the UI discloses this
  before you can turn it on, and the key never leaves `localStorage`.
- Account numbers detected near an "Account No" / "No Akaun" label are
  masked (`****3322`) everywhere the app keeps or displays OCR text.
- **Clear all data** in Settings permanently deletes every stored slip and
  setting from this browser.

Clicking a slip's thumbnail opens a full-size preview showing the
**processed** image (cropped, deskewed, black-and-white) that OCR actually
read — click **"Show original photo"** in that preview to switch to the
original, full-colour, upright photo you captured or uploaded. Both versions
are kept for every slip.

## Known limitations

- Image preprocessing (`src/imageProcessing/preprocess.ts`) uses a
  Canvas-only pipeline: EXIF auto-rotation is exact, but cropping is a
  plain content-bounding-box (not perspective-corrected) and there is no
  true deskew. For a more advanced pipeline (perspective correction, real
  deskew via Hough transform), swap this module for one backed by
  [OpenCV.js](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html).
- The bundled Tesseract.js WASM core is the SIMD build; browsers without
  WASM SIMD support (roughly pre-2021) aren't supported by the bundled
  on-device engine.
- PDF support rasterizes only the **first page** of a PDF.

## Testing

```bash
npm test
```

`src/parsing/__tests__/parseSlip.test.ts` runs the parser against 5+
realistic OCR text samples covering Maybank, CIMB, Public Bank, an
unrecognized bank, and Hong Leong Bank slips — including Malay labels,
month-name dates, 2-digit years, OCR digit confusions, a missing field, an
unknown bank, and a garbage/no-text input — asserting the extracted fields,
confidence-driven status, account-number masking, and the day-first vs.
month-first ambiguity setting.
