import { createClient } from '../../../../lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
    }
  }

  // Fallback if transaction fails
  return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_callback_failed`);
}
