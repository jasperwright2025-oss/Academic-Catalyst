import { createClient } from '../../../../lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const supabase = await createClient();

  try {
    const { email, password, full_name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'Email and password are required.' }, { status: 400 });
    }

    // 1. Sign up the user inside Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name },
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'AUTH_FAULT', message: authError?.message || 'Registration failed.' }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Initialize an elite admin client to provision profiles bypass-RLS
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 3. Create the profile mapping row
    await adminSupabase.from('users').insert({
      id: userId,
      email,
      full_name,
    });

    // 4. Provision a standard default Free Tier subscription record
    await adminSupabase.from('subscriptions').insert({
      user_id: userId,
      tier: 'free',
      status: 'active',
      proposals_remaining: 0,
      dissertations_remaining: 0,
    });

    // 5. Initialize their voice profile entry
    await adminSupabase.from('voice_profiles').insert({
      user_id: userId,
      is_custom: false,
    });

    return NextResponse.json({ success: true, message: 'Account provisioned successfully.' });

  } catch (error) {
    console.error('Registration API Error:', error);
    return NextResponse.json({ error: 'SERVER_FAULT', message: 'Internal registration processing fault.' }, { status: 500 });
  }
}
