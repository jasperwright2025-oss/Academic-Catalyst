import { createClient } from '../../../lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Login required.' }, { status: 401 });
    }

    // 2. Parse search parameters from URL (e.g. ?page=1&limit=10&type=proposal)
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const type = searchParams.get('type'); // 'proposal', 'field_data', 'dissertation'

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 3. Query documents list (Omitting the massive 'generated_content' body text for speed)
    let query = supabase
      .from('documents')
      .select('id, document_type, research_topic, target_institution, is_unlocked, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (type) {
      query = query.eq('document_type', type);
    }

    const { data: docs, error: docError } = await query;

    if (docError) {
      console.error('Fetch documents list exception:', docError);
      return NextResponse.json({ error: 'DATABASE_ERROR', message: 'Could not fetch documents.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, page, limit, data: docs || [] });

  } catch (error) {
    console.error('Documents collection API fault:', error);
    return NextResponse.json({ error: 'SERVER_FAULT' }, { status: 500 });
  }
}
