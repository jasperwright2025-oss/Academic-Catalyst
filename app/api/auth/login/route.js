import { createClient } from '../../../../lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const supabase = await createClient();

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'Email and password are required.' }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json({ error: 'LOGIN_FAILED', message: 'Invalid email or password.' }, { status: 401 });
    }

    return NextResponse.json({ success: true, message: 'Login verification successful.' });

  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json({ error: 'SERVER_FAULT', message: 'Internal validation process failure.' }, { status: 500 });
  }
}
