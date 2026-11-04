import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Only allow redirects to pages on this site (stops the link being used to send people elsewhere).
const ALLOWED_NEXT = ['/dashboard', '/reset-password'];

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next') || '/dashboard';
  const next = ALLOWED_NEXT.includes(nextParam) ? nextParam : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    }
    console.error('Auth callback error:', error.status, error.message);
  }

  // A reset link that fails (expired, or opened in a different browser) goes back to the reset request page.
  if (next === '/reset-password') {
    return NextResponse.redirect(`${requestUrl.origin}/forgot-password?error=link_expired`);
  }
  return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_callback_failed`);
}
