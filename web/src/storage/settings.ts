import { DEFAULT_SETTINGS, type AppSettings } from '../types';

const SETTINGS_KEY = 'bank-slip-ocr:settings';

/**
 * One-time setup link support: ?paddleUrl=...&paddleKey=... pre-fills and
 * saves PaddleOCR settings on first visit, then the URL is scrubbed so the
 * values don't linger in browser history. This exists so a PaddleOCR server
 * + API key can be shared with other people as a link instead of a secret
 * baked into the public JS bundle (which ships to every visitor, not just
 * the people it's meant for).
 */
function applySetupLinkParams(settings: AppSettings): AppSettings {
  const params = new URLSearchParams(window.location.search);
  const paddleUrl = params.get('paddleUrl');
  const paddleKey = params.get('paddleKey');
  if (!paddleUrl && !paddleKey) return settings;

  const next: AppSettings = {
    ...settings,
    ocrEngine: 'paddleocr',
    ...(paddleUrl ? { paddleOcrServerUrl: paddleUrl } : {}),
    ...(paddleKey ? { paddleOcrApiKey: paddleKey } : {}),
  };

  saveSettings(next);
  params.delete('paddleUrl');
  params.delete('paddleKey');
  const query = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));

  return next;
}

export function loadSettings(): AppSettings {
  let settings: AppSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    settings = DEFAULT_SETTINGS;
  }
  return applySetupLinkParams(settings);
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
