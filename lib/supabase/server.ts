import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";
import type { Database } from "./database.types";

// For Server Components, Route Handlers and Server Actions.
// Create one per request; never share it between requests.
// cookies() is a request-time API: with cacheComponents, call this inside
// <Suspense> (Server Components) or in a Route Handler.
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore once a proxy refreshes the session (future Auth spec).
        }
      },
    },
  });
}
