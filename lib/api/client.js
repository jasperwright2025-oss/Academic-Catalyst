// Client-side helpers for the Academic Catalyst API.
// Import these from V0 components instead of calling fetch() in each screen.

export class ApiError extends Error {
  constructor(status, code, message, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code; // e.g. UNAUTHORIZED, PAYWALL_TRIGGERED
    this.data = data; // full JSON body (paywall target, retry_after, ...)
  }
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error ?? "REQUEST_FAILED",
      data?.message ?? "Something went wrong. Please try again.",
      data
    );
  }
  return data;
}

// ---------- Error helpers for UI code ----------
export const isUnauthorized = (err) => err instanceof ApiError && err.status === 401;
export const isPaywall = (err) => err instanceof ApiError && err.code === "PAYWALL_TRIGGERED";
export const isRateLimited = (err) => err instanceof ApiError && err.status === 429;

// Which products to offer when /api/generate answers PAYWALL_TRIGGERED.
// err.data.target is one of these keys.
export const PAYWALL_OFFERS = {
  tier_1: {
    title: "Unlock your next proposal",
    single: "proposal_single",
    subscription: "proposal_architect",
  },
  tier_2_data: {
    title: "Unlock the Data Simulation engine",
    single: "data_simulation_single",
    subscription: "data_suite",
  },
  tier_3_dissertation: {
    title: "Unlock your dissertation report",
    single: "dissertation_single",
    subscription: "consultant_enterprise",
  },
};

// ---------- Generation ----------
// action_type: "generate_proposal" | "simulate_data" | "compile_dissertation"
export async function generateDocument(payload) {
  // Returns the whole response:
  //   { locked: false, payload, document_id }                        full document
  //   { locked: true, preview, locked_sections, total_words, document_id, free_previews_remaining }  free preview
  return request("/api/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------- Billing ----------
export const getBillingStatus = () => request("/api/billing/status");

// Sends the browser to Flutterwave's hosted payment page.
export async function startCheckout(productKey) {
  const data = await request("/api/payment/checkout", {
    method: "POST",
    body: JSON.stringify({ product_key: productKey }),
  });
  window.location.href = data.checkout_url;
}

// After returning from the payment page the webhook may take a few seconds.
// Polls until the credits or plan change, or gives up after maxTries.
export async function waitForBillingUpdate(before, { maxTries = 10, intervalMs = 3000 } = {}) {
  const snapshot = (s) => JSON.stringify([s.plan, s.credits]);
  const baseline = snapshot(before);

  for (let i = 0; i < maxTries; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const latest = await getBillingStatus();
    if (snapshot(latest) !== baseline) return latest;
  }
  return null; // not updated yet; tell the user it can take a minute
}

// ---------- Documents ----------
export function listDocuments({ page = 1, limit = 20, type } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (type) params.set("type", type);
  return request(`/api/documents?${params}`);
}

export const getDocument = (id) => request(`/api/documents/${encodeURIComponent(id)}`);

export const unlockDocument = (id) =>
  request(`/api/documents/${encodeURIComponent(id)}/unlock`, { method: "POST" });

export const deleteDocument = (id) =>
  request(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });

// ---------- Authentication ----------
export const register = ({ email, password, full_name }) =>
  request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name }),
  });

export const login = ({ email, password }) =>
  request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const logout = () => request("/api/auth/logout", { method: "POST" });

// Crypto (USDT) checkout. ASSUMES your /api/payment/crypto/checkout route accepts
// { product_key } and answers { checkout_url }. Adjust here if yours differs.
export async function startCryptoCheckout(productKey) {
  const data = await request("/api/payment/crypto/checkout", {
    method: "POST",
    body: JSON.stringify({ product_key: productKey }),
  });
  window.location.href = data.checkout_url;
}
