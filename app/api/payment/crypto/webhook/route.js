import { adminSupabase } from '../../../../../lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. VERIFY WEBHOOK AUTHENTICITY USING SECRET SIGNATURE HEADERS
    const signature = request.headers.get('bvnk-webhook-signature');
    if (!signature || signature !== process.env.CRYPTO_WEBHOOK_HASH) {
      return NextResponse.json({ error: 'UNAUTHORIZED_WEBHOOK' }, { status: 401 });
    }

    const payload = await request.json();
    
    // Only proceed if transaction status has reached definitive success
    if (payload.status !== 'SUCCESS' && payload.status !== 'PAID') {
      return NextResponse.json({ received: true, status: 'ignored' });
    }

    // EXTRACT TRACKING VARIABLES FROM WEBHOOK METADATA
    const { userId, itemPurchased, trackingTier } = payload.metaData || {};
    const transactionReference = payload.id || payload.reference;
    const paymentAmount = payload.amount;

    if (!userId || !itemPurchased || !transactionReference) {
      return NextResponse.json({ error: 'DATA_MISMATCH', message: 'Missing tracing parameters.' }, { status: 400 });
    }

    // 2. CLAUDE'S CRITICAL DUPLICATE DELIVERY SAFETIE GATES
    // Check if this payment has already been logged and processed in our database
    const { data: existingTx } = await adminSupabase
      .from('transactions')
      .select('id')
      .eq('gateway_reference', transactionReference)
      .maybeSingle();

    if (existingTx) {
      // If found, immediately stop processing and return a friendly success status code. This stops duplicate credit duplication!
      return NextResponse.json({ received: true, message: 'Duplicate transaction ignored safely.' });
    }

    // 3. MUTATION PASS A: LOG HISTORICAL TRANSACTION TO ACCOUNT PROFILE
    const { error: txError } = await adminSupabase
      .from('transactions')
      .insert({
        user_id: userId,
        payment_gateway: 'bvnk_crypto',
        gateway_reference: transactionReference,
        amount_usd: paymentAmount,
        item_purchased: itemPurchased,
        status: 'completed'
      });

    if (txError) {
      console.error('Database logging failure:', txError);
      return NextResponse.json({ error: 'LOGGING_FAULT' }, { status: 500 });
    }

    // 4. MUTATION PASS B: ALLOCATE PRICING MATRIX CREDITS AND UPGRADE SUBSCRIPTION
    if (itemPurchased === 'single_proposal') {
      // Uses our secured RPC function to increment credit
      await adminSupabase.rpc('increment_proposal_credit', { target_user_id: userId });
      
    } else if (itemPurchased === 'subscription_plan' && trackingTier !== 'none') {
      
      let proposalAllotment = 0;
      let dissertationAllotment = 0;

      if (trackingTier === 'proposal_architect') {
        proposalAllotment = 5;
      } else if (trackingTier === 'data_suite') {
        proposalAllotment = 5;
      } else if (trackingTier === 'consultant_enterprise') {
        proposalAllotment = 9999; // Unlimited for agencies
        dissertationAllotment = 3;
      }

      await adminSupabase
        .from('subscriptions')
        .update({
          tier: trackingTier,
          status: 'active',
          proposals_remaining: proposalAllotment,
          dissertations_remaining: dissertationAllotment,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('user_id', userId);
    }

    return NextResponse.json({ received: true, provisioned: true });

  } catch (error) {
    console.error('Crypto Webhook Execution Exception:', error);
    return NextResponse.json({ error: 'SERVER_FAULT' }, { status: 500 });
  }
}
