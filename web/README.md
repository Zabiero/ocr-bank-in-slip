# Bank-In Slip Scanner

A mobile-first web app that reads Malaysian bank-in slips (deposit/transfer
receipts) — by camera or file upload — and extracts date, time, amount,
reference number and bank name into an editable, exportable table.

Everything runs **client-side**: OCR, image cleanup, parsing and storage all
happen in the browser, with no backend required. An optional central
record-keeping feature (off by default) can additionally sync each scan to a
Supabase project for business/admin use. See [Privacy](#privacy) below.

## Architecture

```
web/
  src/
    types.ts                 Shared types: SlipRecord, ParsedSlip, AppSettings, ...
    processFile.ts            Orchestrates one file: preprocess -> OCR -> parse -> SlipRecord
    duplicateDetection.ts     Same reference no. + amount => duplicate warning
    sortSlips.ts              Sorts slips by any column, missing values always last
    filterSlips.ts            Filter by bank/reference/date range, shared by both tables
    collectSubmission.ts      Optional: best-effort upload of a scan to Supabase

    lib/
      supabaseClient.ts        null unless VITE_SUPABASE_* env vars are set

    admin/                    Optional admin view at /#admin - see "Central record-keeping"
      AdminApp.tsx              Auth gate (Supabase email/password login)
      AdminTable.tsx             Same sort/filter/image-preview UX as the local table
      adminSlips.ts              Fetch/delete rows, signed image URLs

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
      banks.ts                   Configurable bank/e-wallet name + alias list
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

## Adding a new bank (or e-wallet)

The "Bank" field really means "who issued this receipt" — `src/parsing/banks.ts`
already covers Malaysia's licensed banks and digital banks alongside common
digital wallets/e-money apps (Touch 'n Go eWallet, ShopeePay, GrabPay, Boost,
Setel, BigPay). To add another one, append an entry to the `BANKS` array:

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

Numeric `DD/MM` vs `MM/DD` ambiguity (when both parts are ≤ 12) is always
resolved day-first, matching Malaysian convention — there's no ambiguous-
dates setting to configure.

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

## Sorting

Click any column header in the results table (Date, Time, Amount, Reference
No., Bank/Wallet, Status) to sort by it; click again to flip between
ascending and descending. Date/Amount default to newest/highest first,
Reference No./Bank/Status default to A-Z, matching how each is normally
read. A slip missing that field always sorts to the bottom, in either
direction — a blank isn't a low value, it's not a value at all. Implemented
in `src/sortSlips.ts`, unit tested independently of the table component.

## Privacy

- The default OCR engine and all image preprocessing run **on-device**;
  slip photos are processed entirely in the browser doing the scanning.
- Slips and settings are stored **locally** in that browser, via
  **IndexedDB** (`bank-slip-ocr` database) and `localStorage` - this local
  copy is never sent anywhere by this app on its own.
- If **central record-keeping** is configured (see below), each completed
  scan is *also* uploaded - full images and all - to a shared Supabase
  project so the business owner can review every submission from one place.
  This is a deliberate feature for internal/staff use (e.g. a cashier
  scanning payment proof), not a public-facing default - decide whether the
  people using this deployment need to be told before turning it on.
- If you enable **Cloud Vision** in Settings, each slip image is sent to
  Google's Vision API using your own API key — the UI discloses this
  before you can turn it on, and the key never leaves `localStorage`.
- Account numbers detected near an "Account No" / "No Akaun" label are
  masked (`****3322`) everywhere the app keeps or displays OCR text -
  including in the central record, since it's built from the same masked
  text.
- **Clear all data** in Settings permanently deletes every locally stored
  slip and setting from that browser; it does not touch the central record.

Clicking a slip's thumbnail opens a full-size preview showing the
**processed** image (cropped, deskewed, black-and-white) that OCR actually
read — click **"Show original photo"** in that preview to switch to the
original, full-colour, upright photo you captured or uploaded. Both versions
are kept for every slip.

## Central record-keeping

Optional: lets a business owner see every slip scanned by anyone using the
app (e.g. a cashier), from one admin page - full images included. Off by
default; nothing changes until you finish this setup.

**1. Create a free Supabase project** at [supabase.com](https://supabase.com)
(Database → free tier is enough). Note down, from Settings → API:
the **Project URL** and the **anon/public** API key.

**2. Run this once in the Supabase SQL Editor** to create the table, storage
bucket, and access rules (the `anon` role, used by every visitor's browser,
can insert/update its own submissions; only a signed-in admin can *delete*).
Storage needs both an INSERT *and* an UPDATE policy for `anon` even though
the app only ever uploads new files - Supabase Storage's own upload
implementation always runs an upsert-shaped query under the hood, and
Postgres requires the UPDATE policy to be satisfiable for that query to be
planned at all, regardless of whether a real conflict occurs. It also needs
a SELECT policy for `anon`, for the same reason: an INSERT/UPDATE's
`RETURNING` clause (used to report the upload back to the browser) is
itself checked against the SELECT policy. `authenticated` (a signed-in
admin) gets its own INSERT/UPDATE too, so testing or scanning while logged
into the admin account works exactly the same as an anonymous cashier's
browser - Supabase Auth sessions are shared across the whole site, so it's
easy to end up "authenticated" without meaning to.

```sql
create table public.slips (
  id uuid primary key,
  created_at timestamptz not null default now(),
  file_name text,
  date text,
  time text,
  amount numeric,
  currency text,
  reference_no text,
  bank text,
  status text not null,
  ocr_text text,
  ocr_confidence numeric,
  ocr_engine text,
  masked_account_numbers text[],
  original_image_path text,
  processed_image_path text
);

alter table public.slips enable row level security;

create policy "anon can insert slips" on public.slips
  for insert to anon with check (true);
create policy "anon can update slips" on public.slips
  for update to anon using (true) with check (true);
create policy "authenticated can also insert slips" on public.slips
  for insert to authenticated with check (true);
create policy "authenticated can update slips" on public.slips
  for update to authenticated using (true) with check (true);
create policy "authenticated can read slips" on public.slips
  for select to authenticated using (true);
create policy "authenticated can delete slips" on public.slips
  for delete to authenticated using (true);

insert into storage.buckets (id, name, public) values ('slip-images', 'slip-images', false);

create policy "anon can upload slip images" on storage.objects
  for insert to anon with check (bucket_id = 'slip-images');
create policy "anon can update slip images" on storage.objects
  for update to anon using (bucket_id = 'slip-images') with check (bucket_id = 'slip-images');
create policy "anon can read own upload metadata" on storage.objects
  for select to anon using (bucket_id = 'slip-images');
create policy "authenticated can also upload slip images" on storage.objects
  for insert to authenticated with check (bucket_id = 'slip-images');
create policy "authenticated can also update slip images" on storage.objects
  for update to authenticated using (bucket_id = 'slip-images') with check (bucket_id = 'slip-images');
create policy "authenticated can read slip images" on storage.objects
  for select to authenticated using (bucket_id = 'slip-images');
create policy "authenticated can delete slip images" on storage.objects
  for delete to authenticated using (bucket_id = 'slip-images');
```

**3. Create your own admin login**: Supabase dashboard → Authentication →
Users → Add user (email + password). This is the account you'll use to view
records - there's no public sign-up in the app itself.

**4. Wire up the app**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(from step 1) as GitHub repo secrets (Settings → Secrets and variables →
Actions) so the deploy workflow can build them in - see `.env.example` for
local dev. Push any commit (or re-run the workflow) to pick them up.

**5. View records** at `<your-site-url>/#admin` (e.g.
`https://zabiero.github.io/ocr-bank-in-slip/#admin`), signing in with the
account from step 3. The admin table supports the same sort/filter as the
main results table, plus viewing each slip's original photo, correcting any
field directly (click a cell, same as the main table), and deleting
records. It's a separate view from the local one on the same device -
scanning a slip still saves it locally first either way; the central copy is
an additional, best-effort upload (see `src/collectSubmission.ts`) that
never blocks or fails the local scan if it can't reach Supabase. Correcting
a field or re-scanning a slip afterwards syncs that change to the central
row too (images aren't re-uploaded for these, only the parsed fields).

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
confidence-driven status, account-number masking, and day-first resolution
of ambiguous numeric dates.
