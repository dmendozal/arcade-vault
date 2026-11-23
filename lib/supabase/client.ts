import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

// For Client Components. createBrowserClient is a singleton under the hood.
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
