import { useMemo, useState } from 'react';
import CameraCapture from './components/CameraCapture';
import UploadDropzone from './components/UploadDropzone';
import ResultsTable from './components/ResultsTable';
import Filters, { EMPTY_FILTERS, type FilterState } from './components/Filters';
import TotalsFooter from './components/TotalsFooter';
import SettingsPanel from './components/SettingsPanel';
import ProcessingQueue, { type QueueItem } from './components/ProcessingQueue';
import { useSlips } from './hooks/useSlips';
import { useSettings } from './hooks/useSettings';
import { processFile, rescanSlip } from './processFile';
import { editSlipField, computeStatus, type EditableSlipField } from './parsing/parseSlip';
import { findDuplicate } from './duplicateDetection';
import { downloadCsv } from './export/csv';
import { downloadXlsx } from './export/xlsx';
import { copySlipsToClipboard } from './export/clipboard';
import { downloadTrainingData } from './export/trainingData';
import type { ProcessingStage, SlipRecord } from './types';

function parseDdMmYyyy(value: string | null): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

type Toast = { id: string; message: string; tone: 'info' | 'warning' };

export default function App() {
  const { slips, loaded, upsertSlip, removeSlip, clearAll } = useSlips();
  const { settings, setSettings } = useSettings();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [rescanningId, setRescanningId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function pushToast(message: string, tone: Toast['tone'] = 'info') {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }

  async function handleFiles(files: File[]) {
    const items = files.map((file) => ({ id: crypto.randomUUID(), file }));
    setQueue((prev) => [...prev, ...items.map(({ id, file }) => ({ id, fileName: file.name, stage: 'queued' as ProcessingStage }))]);

    let workingSlips = slips;
    for (const { id, file } of items) {
      const record = await processFile(file, settings, (stage) => {
        setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, stage } : q)));
      });

      const duplicateOf = findDuplicate(workingSlips, record);
      const finalRecord: SlipRecord = duplicateOf ? { ...record, status: 'duplicate' } : record;

      if (duplicateOf) {
        pushToast(
          `Possible duplicate: ref "${finalRecord.parsed.referenceNo.value}" for RM ${finalRecord.parsed.amount.value?.toFixed(2)} already exists.`,
          'warning',
        );
      } else if (finalRecord.status === 'error') {
        pushToast(`${file.name}: ${finalRecord.errorMessage ?? 'Could not process this slip.'}`, 'warning');
      }

      await upsertSlip(finalRecord);
      workingSlips = [finalRecord, ...workingSlips];
      setQueue((prev) => prev.filter((q) => q.id !== id));
    }
  }

  function handleEdit(id: string, field: EditableSlipField, value: string) {
    const slip = slips.find((s) => s.id === id);
    if (!slip) return;
    const parsed = editSlipField(slip.parsed, field, value);
    upsertSlip({ ...slip, parsed, status: computeStatus(parsed) });
  }

  async function handleRescan(id: string) {
    const slip = slips.find((s) => s.id === id);
    if (!slip) return;
    setRescanningId(id);
    try {
      const updated = await rescanSlip(slip, settings);
      const duplicateOf = findDuplicate(
        slips.filter((s) => s.id !== id),
        updated,
      );
      await upsertSlip(duplicateOf ? { ...updated, status: 'duplicate' } : updated);
    } finally {
      setRescanningId(null);
    }
  }

  const filteredSlips = useMemo(() => {
    return slips.filter((s) => {
      if (filters.bank && s.parsed.bank.value !== filters.bank) return false;
      if (filters.search && !(s.parsed.referenceNo.value ?? '').toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.dateFrom || filters.dateTo) {
        const d = parseDdMmYyyy(s.parsed.date.value);
        if (!d) return false;
        if (filters.dateFrom && d < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && d > new Date(`${filters.dateTo}T23:59:59`)) return false;
      }
      return true;
    });
  }, [slips, filters]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bank-In Slip Scanner</h1>
          <p className="text-sm text-slate-500">
            {settings.ocrEngine === 'tesseract' &&
              'Processed on-device — nothing leaves your browser.'}
            {settings.ocrEngine === 'cloud-vision' &&
              'Cloud Vision is enabled — slip photos are sent to Google using your API key.'}
            {settings.ocrEngine === 'paddleocr' &&
              'PaddleOCR (local server) is enabled — slip photos are sent to your own local server, not the internet.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Settings
        </button>
      </header>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          📷 Take Photo
        </button>
        <UploadDropzone onFiles={handleFiles} />
      </div>

      <div className="mb-4">
        <ProcessingQueue items={queue} />
      </div>

      {toasts.length > 0 && (
        <div className="mb-4 space-y-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded border px-3 py-2 text-sm ${
                t.tone === 'warning' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' : 'border-blue-200 bg-blue-50 text-blue-800'
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}

      <div className="mb-4">
        <Filters value={filters} onChange={setFilters} />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadCsv(filteredSlips)}
          disabled={filteredSlips.length === 0}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => downloadXlsx(filteredSlips)}
          disabled={filteredSlips.length === 0}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          Export Excel
        </button>
        <button
          type="button"
          onClick={async () => {
            await copySlipsToClipboard(filteredSlips);
            pushToast('Copied to clipboard as tab-separated text.');
          }}
          disabled={filteredSlips.length === 0}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={() => downloadTrainingData(filteredSlips)}
          disabled={filteredSlips.length === 0}
          title="Downloads each slip's image plus its current field values as JSON - fix any wrong fields in the table first, since whatever is shown becomes the label."
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          Export training data
        </button>
      </div>

      {loaded ? (
        <ResultsTable
          slips={filteredSlips}
          onEdit={handleEdit}
          onDelete={removeSlip}
          onRescan={handleRescan}
          rescanningId={rescanningId}
        />
      ) : (
        <p className="py-12 text-center text-sm text-slate-500">Loading saved slips…</p>
      )}

      <div className="mt-4">
        <TotalsFooter slips={filteredSlips} />
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={(file) => {
            setShowCamera(false);
            handleFiles([file]);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClearAll={() => {
            clearAll();
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
