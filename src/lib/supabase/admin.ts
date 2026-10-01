import { createClient } from "@supabase/supabase-js";
import { assertSupabaseServerEnv, env } from "@/lib/env";

export function createAdminClient() {
  assertSupabaseServerEnv();

  return createClient(env.supabaseUrl!, env.supabaseSecretKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
