/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL - only needed for the central record-keeping feature. See README.md "Central record-keeping". */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon/public API key - safe to expose client-side; access is enforced by RLS policies, not secrecy of this key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
