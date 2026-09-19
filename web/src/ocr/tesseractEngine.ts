import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import type { OcrEngine, OcrResult } from './engine';

// All engine assets (worker script, WASM core, trained language data) are
// bundled locally under public/tesseract/ rather than fetched from
// tesseract.js's default jsdelivr CDN, so the on-device engine has zero
// network dependency and keeps working fully offline. See README.md
// "OCR engines" for how to update or add more languages.
const TESSERACT_BASE = `${import.meta.env.BASE_URL}tesseract`;
const WORKER_OPTIONS = {
  workerPath: `${TESSERACT_BASE}/worker.min.js`,
  corePath: `${TESSERACT_BASE}/tesseract-core-simd-lstm.wasm.js`,
  langPath: `${TESSERACT_BASE}/lang-data`,
  gzip: true,
};

let workerPromise: Promise<Worker> | null = null;

async function initWorker(worker: Worker): Promise<Worker> {
  // Slips aren't uniform paragraphs - they're scattered label/value fragments
  // (printed slips) or small, varied-size UI text (mobile "share receipt"
  // screenshots). SPARSE_TEXT ("find as much text as possible, no particular
  // order") catches small/secondary text that the default AUTO mode - tuned
  // for paragraph-shaped documents - can skip over entirely.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  return worker;
}

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    // English + Malay (Bahasa Melayu) covers the "Tarikh"/"Masa"/"Jumlah"
    // style labels seen on Malaysian bank slips as well as English ones.
    workerPromise = createWorker('eng+msa', OEM.LSTM_ONLY, WORKER_OPTIONS)
      .then(initWorker)
      .catch(async (err) => {
        console.warn('Falling back to English-only OCR (Malay traineddata failed to load):', err);
        workerPromise = null;
        return createWorker('eng', OEM.LSTM_ONLY, WORKER_OPTIONS).then(initWorker);
      });
  }
  return workerPromise;
}

export const tesseractEngine: OcrEngine = {
  id: 'tesseract',
  label: 'Tesseract.js (on-device, offline)',
  requiresNetwork: false,

  async extractText(image: HTMLCanvasElement): Promise<OcrResult> {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);

    const boxes = (data.words ?? []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 },
    }));

    return {
      text: data.text,
      confidence: data.confidence,
      boxes,
    };
  },

  async terminate(): Promise<void> {
    if (workerPromise) {
      const worker = await workerPromise;
      await worker.terminate();
      workerPromise = null;
    }
  },
};
