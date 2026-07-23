import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di .env.local.",
    );
  }

  if (serviceRoleKey.startsWith("sb_publishable")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY masih berisi publishable/anon key. Ganti dengan service_role atau secret key server Supabase agar bisa insert saat ingest.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
