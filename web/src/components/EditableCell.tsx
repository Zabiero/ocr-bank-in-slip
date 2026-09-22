import { useState, type KeyboardEvent } from 'react';
import { CONFIDENCE_WARN_THRESHOLD } from '../types';

interface EditableCellProps {
  value: string | null;
  confidence: number;
  onCommit: (value: string) => void;
  placeholder?: string;
  /** True for a field that's genuinely absent on plenty of valid slips (e.g.
   * time, on a document that only ever states a date) - missing shows as a
   * neutral "N/A" instead of the red "missing" flag used for fields that
   * should always be present, and doesn't push the slip into needs-review. */
  isOptional?: boolean;
}

export default function EditableCell({ value, confidence, onCommit, placeholder, isOptional }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const cellClass =
    value == null ? (isOptional ? 'field-ok' : 'field-missing') : confidence < CONFIDENCE_WARN_THRESHOLD ? 'field-warn' : 'field-ok';

  if (editing) {
    return (
      <input
        autoFocus
        className="w-full min-w-[6rem] rounded border border-blue-400 px-1 py-0.5 text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onCommit(draft);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') {
            setEditing(false);
            onCommit(draft);
          } else if (e.key === 'Escape') {
            setDraft(value ?? '');
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value ?? '');
        setEditing(true);
      }}
      className={`w-full min-w-[6rem] rounded px-1 py-0.5 text-left text-sm ${cellClass}`}
      title="Click to edit"
    >
      {value ??
        (isOptional ? (
          <span className="italic text-slate-400">{placeholder ?? 'N/A'}</span>
        ) : (
          <span className="italic text-red-600">{placeholder ?? 'missing'}</span>
        ))}
    </button>
  );
}
