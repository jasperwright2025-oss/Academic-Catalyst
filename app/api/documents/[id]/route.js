import { createClient } from '../../../../lib/supabase/server';
import { NextResponse } from 'next/server';

// Next.js 15 requires awaiting dynamic route parameter variables
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Login required.' }, { status: 401 });
    }

    // 2. Fetch the specific document row
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (docError || !doc) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Document not found.' }, { status: 404 });
    }

    // 3. Security Check: If document is locked, protect your IP by withholding full text
    if (!doc.is_unlocked) {
      return NextResponse.json({
        id: doc.id,
        document_type: doc.document_type,
        research_topic: doc.research_topic,
        locked: true,
        generated_content: "This asset is locked. Complete checkout payment parameter protocols to download."
      });
    }

    return NextResponse.json({ success: true, data: doc });

  } catch (error) {
    console.error('Fetch individual asset fault:', error);
    return NextResponse.json({ error: 'SERVER_FAULT' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Explicitly runs the deletion routine filtering by asset ID and owner ID
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: 'DATABASE_ERROR', message: 'Deletion request dropped.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Document deleted successfully.' });

  } catch (error) {
    console.error('Delete asset exception path:', error);
    return NextResponse.json({ error: 'SERVER_FAULT' }, { status: 500 });
  }
}
