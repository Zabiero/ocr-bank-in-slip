import type { ProcessingStage } from '../types';

export interface QueueItem {
  id: string;
  fileName: string;
  stage: ProcessingStage;
}

const STAGE_LABEL: Record<ProcessingStage, string> = {
  queued: 'Queued…',
  preprocessing: 'Enhancing image…',
  ocr: 'Reading text (OCR)…',
  parsing: 'Extracting fields…',
  done: 'Done',
  error: 'Failed',
};

export default function ProcessingQueue({ items }: { items: QueueItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between text-sm">
          <span className="truncate pr-2 text-slate-700">{item.fileName}</span>
          <span className="flex items-center gap-2 text-blue-700">
            {item.stage !== 'done' && item.stage !== 'error' && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            )}
            {STAGE_LABEL[item.stage]}
          </span>
        </div>
      ))}
    </div>
  );
}
