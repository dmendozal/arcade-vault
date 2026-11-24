import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";
import type { Database } from "./database.types";

// Cookie-less client for reads inside `use cache` functions, where
// cookies()/headers() are not allowed. Anonymous (publishable key) only:
// never use it for anything that depends on the user's session.
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createSupabaseClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
