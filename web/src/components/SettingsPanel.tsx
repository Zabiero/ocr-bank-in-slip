import type { AppSettings } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export default function SettingsPanel({ settings, onChange, onClearAll, onClose }: SettingsPanelProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">OCR engine</label>
            <select
              value={settings.ocrEngine}
              onChange={(e) => onChange({ ...settings, ocrEngine: e.target.value as AppSettings['ocrEngine'] })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="tesseract">Tesseract.js — on-device, private, works offline (recommended)</option>
              <option value="cloud-vision">Google Cloud Vision — cloud, more accurate on photos</option>
            </select>
          </div>

          {settings.ocrEngine === 'cloud-vision' && (
            <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
              <p className="mb-2 text-yellow-800">
                Cloud Vision sends each slip photo to Google's servers using your own API key. The key is stored only
                in this browser's local storage; slip images are never stored on any server by this app.
              </p>
              <label className="block text-xs font-medium text-slate-700">Google Cloud Vision API key</label>
              <input
                type="password"
                value={settings.cloudVisionApiKey}
                onChange={(e) => onChange({ ...settings, cloudVisionApiKey: e.target.value })}
                placeholder="AIza…"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          )}

          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm text-slate-600">
              All slips and settings are stored only in this browser (IndexedDB/local storage) — nothing is uploaded
              unless you enable Cloud Vision above. Account numbers detected on slips are masked automatically.
            </p>
            <button
              type="button"
              onClick={() => {
                if (confirm('Delete all saved slips and settings from this browser? This cannot be undone.')) {
                  onClearAll();
                }
              }}
              className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Clear all data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
