// Server-side check of the Cloudflare Turnstile security check on the sign-up form.
// Set TURNSTILE_SECRET_KEY in Vercel to switch it on. Without the key the check is skipped (with a warning in the logs),
// so a typo in Vercel can never lock customers out.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.warn("Turnstile is not configured (TURNSTILE_SECRET_KEY is missing), so the security check was skipped.");
    return { ok: true, skipped: true };
  }

  if (!token || typeof token !== "string") {
    return { ok: false, message: "Please complete the security check and try again." };
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();

    if (data?.success) return { ok: true };

    console.warn("Turnstile rejected a token:", data?.["error-codes"]);
    return { ok: false, message: "The security check did not pass. Please try again." };
  } catch (error) {
    console.error("Turnstile check could not run:", error);
    return { ok: false, message: "We could not run the security check. Please try again in a moment." };
  }
}
