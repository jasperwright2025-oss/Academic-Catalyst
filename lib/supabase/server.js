import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Reads and writes the auth session through Next.js cookies, and still runs
 * under RLS (auth.uid() = user_id) because it uses the anon key.
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore as long as middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Example helper: returns the signed-in user or a JSON error response.
 * Use it at the top of Route Handlers.
 *
 *   const { user, errorResponse } = await getAuthenticatedUser();
 *   if (errorResponse) return errorResponse;
 */
export async function getAuthenticatedUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        user: null,
        errorResponse: Response.json(
          { error: "Unauthorized. Please sign in to continue." },
          { status: 401 }
        ),
      };
    }

    return { user, errorResponse: null };
  } catch (err) {
    return {
      user: null,
      errorResponse: Response.json(
        { error: "Failed to verify your session.", details: err.message },
        { status: 500 }
      ),
    };
  }
}
