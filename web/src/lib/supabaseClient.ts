import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_CONFIGURED = Boolean(url && anonKey);

/**
 * null when VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY aren't set (local dev
 * without a .env.local, or a deploy before the business owner has finished
 * the Supabase setup in README.md "Central record-keeping"). Every caller
 * treats that as "the collect-a-central-record feature is simply off" rather
 * than an error - scanning/exporting locally must keep working either way.
 */
export const supabase: SupabaseClient | null = SUPABASE_CONFIGURED ? createClient(url!, anonKey!) : null;

export const SLIP_IMAGES_BUCKET = 'slip-images';
