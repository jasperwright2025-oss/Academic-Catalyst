import { createClient } from '../../../../lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return NextResponse.json({ error: 'SIGNOUT_FAULT', message: 'Sign out routine dropped.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Session terminated successfully.' });

  } catch (error) {
    console.error('Logout API Error:', error);
    return NextResponse.json({ error: 'SERVER_FAULT', message: 'Internal server logoff failure.' }, { status: 500 });
  }
}
