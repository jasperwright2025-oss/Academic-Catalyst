import { createClient } from '../../../../lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { verifyTurnstile } from '@/lib/captcha';

export async function POST(request) {
  const supabase = await createClient();

  try {
    const { email, password, full_name, turnstile_token } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'Email and password are required.' }, { status: 400 });
    }

    // 0. Security check: stops bots from creating accounts (skipped until TURNSTILE_SECRET_KEY is set)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const human = await verifyTurnstile(turnstile_token, ip);
    if (!human.ok) {
      return NextResponse.json({ error: 'CAPTCHA_FAILED', message: human.message }, { status: 400 });
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

    // Supabase hides whether an email is already registered by returning a user with no identities.
    if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
      return NextResponse.json(
        { error: 'EMAIL_IN_USE', message: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 }
      );
    }

    const userId = authData.user.id;

    // 2. Initialize an elite admin client to provision profiles bypass-RLS
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 3. Create the profile mapping row
    const { error: profileError } = await adminSupabase.from('users').insert({
      id: userId,
      email,
      full_name,
    });
    if (profileError) console.error('Profile provisioning error:', profileError.message);

    // 4. Provision a standard default Free Tier subscription record
    const { error: subscriptionError } = await adminSupabase.from('subscriptions').insert({
      user_id: userId,
      tier: 'free',
      status: 'active',
      proposals_remaining: 0,
      dissertations_remaining: 0,
    });
    if (subscriptionError) console.error('Subscription provisioning error:', subscriptionError.message);

    // 5. Initialize their voice profile entry
    const { error: voiceError } = await adminSupabase.from('voice_profiles').insert({
      user_id: userId,
      is_custom: false,
    });
    if (voiceError) console.error('Voice profile provisioning error:', voiceError.message);

    return NextResponse.json({ success: true, message: 'Account provisioned successfully.' });

  } catch (error) {
    console.error('Registration API Error:', error);
    return NextResponse.json({ error: 'SERVER_FAULT', message: 'Internal registration processing fault.' }, { status: 500 });
  }
}
