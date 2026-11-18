import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let adminClient: SupabaseClient | null = null;
let isOfflineOrBlocked = false;
let lastCheckTime = 0;

export function isSupabaseAvailable(): boolean {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return false;
  }
  if (isOfflineOrBlocked && Date.now() - lastCheckTime < 15000) {
    return false;
  }
  return true;
}

export function markSupabaseUnreachable() {
  isOfflineOrBlocked = true;
  lastCheckTime = Date.now();
}

/**
 * Returns a Supabase client authenticated with the service role key.
 * Strictly used in server code (route handlers, RPC triggers, background cron).
 * NEVER expose this client or the service role key to the browser.
 */
export function getAdminSupabase(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: async (url, options = {}) => {
          const controller = new AbortController();
          const timer = setTimeout(() => {
            controller.abort();
            markSupabaseUnreachable();
          }, 4000);

          try {
            return await fetch(url, {
              ...options,
              signal: options.signal || controller.signal,
            });
          } catch (err) {
            markSupabaseUnreachable();
            throw err;
          } finally {
            clearTimeout(timer);
          }
        },
      },
    });
  }
  return adminClient;
}

/**
 * Returns a Supabase client with a user's Clerk JWT injected into Authorization header.
 * Allows Supabase Postgres to evaluate RLS policies using `auth.jwt() ->> 'sub'`.
 */
export function getAuthenticatedSupabase(clerkJwt: string): SupabaseClient {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${clerkJwt}`,
      },
    },
  });
}
