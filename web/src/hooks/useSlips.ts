import { useCallback, useEffect, useState } from 'react';
import type { SlipRecord } from '../types';
import { clearAllSlips, deleteSlip, getAllSlips, putSlip } from '../storage/db';

export function useSlips() {
  const [slips, setSlips] = useState<SlipRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getAllSlips()
      .then(setSlips)
      .finally(() => setLoaded(true));
  }, []);

  const upsertSlip = useCallback(async (record: SlipRecord) => {
    await putSlip(record);
    setSlips((prev) => {
      const idx = prev.findIndex((s) => s.id === record.id);
      if (idx === -1) return [record, ...prev];
      const next = [...prev];
      next[idx] = record;
      return next;
    });
  }, []);

  const removeSlip = useCallback(async (id: string) => {
    await deleteSlip(id);
    setSlips((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await clearAllSlips();
    setSlips([]);
  }, []);

  return { slips, loaded, upsertSlip, removeSlip, clearAll };
}
