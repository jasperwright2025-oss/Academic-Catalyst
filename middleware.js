import { NextResponse } from 'next/server';

export function middleware(request) {
  const pathname = request.nextUrl.pathname;

  // 1. SAFE BYPASS: Instantly allow incoming merchant payment webhooks through without modification
  if (pathname.startsWith('/api/payment/webhook') || pathname.startsWith('/api/payment/crypto/webhook')) {
    return NextResponse.next();
  }

  // 2. PROTECT THE DASHBOARD: Check for the presence of the secure Supabase session token cookie
  if (pathname.startsWith('/dashboard')) {
    // Look directly into the native browser request headers for the cookie signature prefix
    const hasSessionCookie = request.cookies.getAll().some(cookie => 
      cookie.name.startsWith('sb-') || cookie.name.includes('auth-token')
    );

    if (!hasSessionCookie) {
      // If no login cookie is found, securely bounce the visitor out to your clean authentication login screen
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Config matches all routes except static public browser asset lines
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
