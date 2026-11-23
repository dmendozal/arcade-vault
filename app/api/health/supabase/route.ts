import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

// TEMPORARY (spec 04): connectivity check. Removed in the last step of the spec.
export async function GET() {
  try {
    await createClient(); // exercises the server client + env validation
    const { url, publishableKey } = getSupabaseEnv();

    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: publishableKey },
      cache: "no-store",
    });

    if (!res.ok) {
      return Response.json({ ok: false, error: `Supabase responded ${res.status}` });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
