import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabaseClient';
import { fetchAllSlipRows } from './adminSlips';
import type { SlipRow } from '../collectSubmission';
import AdminLogin from './AdminLogin';
import AdminTable from './AdminTable';

export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [rows, setRows] = useState<SlipRow[]>([]);
  const [rowsLoaded, setRowsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setSessionLoaded(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    setRowsLoaded(false);
    fetchAllSlipRows()
      .then((data) => {
        setRows(data);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load records.'))
      .finally(() => setRowsLoaded(true));
  }, [session]);

  if (!SUPABASE_CONFIGURED) {
    return (
      <div className="mx-auto mt-24 max-w-md px-4 text-center">
        <h1 className="mb-2 text-lg font-semibold text-slate-900">Central record-keeping isn't set up yet</h1>
        <p className="text-sm text-slate-500">
          See README.md "Central record-keeping" for the Supabase setup steps, then add VITE_SUPABASE_URL and
          VITE_SUPABASE_ANON_KEY as GitHub repo secrets and redeploy.
        </p>
      </div>
    );
  }

  if (!sessionLoaded) {
    return <p className="py-24 text-center text-sm text-slate-500">Loading…</p>;
  }

  if (!session) {
    return <AdminLogin />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Slip records</h1>
          <p className="text-sm text-slate-500">Every slip scanned in the app, from all devices.</p>
        </div>
        <button
          type="button"
          onClick={() => supabase?.auth.signOut()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </header>

      {loadError && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}

      {rowsLoaded ? (
        <AdminTable
          rows={rows}
          onDeleted={(id) => setRows((prev) => prev.filter((r) => r.id !== id))}
          onEdited={(updated) => setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
        />
      ) : (
        <p className="py-12 text-center text-sm text-slate-500">Loading records…</p>
      )}
    </div>
  );
}
