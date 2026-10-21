import { createClient } from '../../../../../lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const supabase = await createClient();

  // 1. VERIFY AUTHENTICATED USER
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Valid login required.' }, { status: 401 });
  }
  const userId = user.id;

  try {
    const { amount_usd, item_purchased, tracking_tier } = await request.json();

    if (!amount_usd || !item_purchased) {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'Missing pricing parameters.' }, { status: 400 });
    }

    // 2. CONSTRUCT PAYLOAD FOR THE CRYPTO PAYMENT GATEWAY (e.g., BVNK API)
    const gatewayPayload = {
      amount: amount_usd,
      currency: 'USD',
      payCurrency: 'USDT', // Targets USDT Stablecoin directly
      network: 'TRON',     // Enforces low-fee TRC-20 blockchain network
      reference: crypto.randomUUID(),
      returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?status=success`,
      callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/payment/crypto/webhook`,
      metaData: {
        userId: userId,
        itemPurchased: item_purchased,
        trackingTier: tracking_tier || 'none'
      }
    };

    // 3. SECURELY CONTACT INTERMEDIARY BLOCKCHAIN MERCHANT GATEWAY
    const response = await fetch('https://bvnk.com', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRYPTO_GATEWAY_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gatewayPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Crypto link generation dropped.');
    }

    // Return the secure hosted crypto processing URL back to the frontend UI
    return NextResponse.json({ success: true, checkout_url: data.redirectUrl });

  } catch (error) {
    console.error('Crypto Checkout Link Error:', error);
    return NextResponse.json({ error: 'SERVER_FAULT', message: 'Crypto processor initialization fault.' }, { status: 500 });
  }
}
