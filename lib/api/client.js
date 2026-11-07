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
    title: "Unlock the Practice Data Pack",
    single: "data_simulation_single",
    subscription: "data_suite",
  },
  tier_3_dissertation: {
    title: "Unlock your dissertation draft report",
    single: "dissertation_single",
    subscription: "consultant_enterprise",
  },
};

// ---------- Generation ----------
// action_type: "generate_proposal" | "simulate_data" | "compile_dissertation"
export async function generateDocument(payload) {
  // Starts a background job and returns { job_id, stage_index, stage_count, stage_label, preview_mode }.
  // Pass job_id to waitForJob() to get the finished result.
  return request("/api/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------- Planning tools and projects ----------
export const getTool = (slug) => request(`/api/tools/${encodeURIComponent(slug)}`);
export const runToolRequest = (slug, input) =>
  request(`/api/tools/${encodeURIComponent(slug)}`, { method: "POST", body: JSON.stringify(input) });
export const listProjects = () => request("/api/projects");
export const sendSupportRequest = (data) => request("/api/support", { method: "POST", body: JSON.stringify(data) });
export function searchLiterature(q, { from, oa, reviews } = {}) {
  const params = new URLSearchParams({ q });
  if (from) params.set("from", String(from));
  if (oa) params.set("oa", "1");
  if (reviews) params.set("reviews", "1");
  return request(`/api/literature/search?${params}`);
}
export const isLimitReached = (err) => err instanceof ApiError && err.code === "LIMIT_REACHED";

// ---------- Background generation jobs ----------
// generateDocument() now starts a job and answers at once with { job_id, stage_label, ... }.
// Follow it with waitForJob(), which resolves with the finished result.
export const getJob = (jobId) => request(`/api/jobs/${encodeURIComponent(jobId)}`);
export const getActiveJob = () => request("/api/jobs/active");
export const isJobInProgress = (err) => err instanceof ApiError && err.code === "JOB_IN_PROGRESS";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Checks a job every few seconds until it is done.
 * onProgress(job) is called after every check, so the page can show the current stage.
 * Resolves with the result ({ locked, preview, ... } or { locked: false, payload, document_id }).
 * Rejects with an ApiError when the job fails, or when stopSignal.stopped becomes true.
 */
export async function waitForJob(jobId, { onProgress, intervalMs = 5000, stopSignal } = {}) {
  let networkErrors = 0;
  for (;;) {
    if (stopSignal?.stopped) throw new ApiError(0, "STOPPED", "Stopped watching the document.");
    let job;
    try {
      job = await getJob(jobId);
      networkErrors = 0;
    } catch (err) {
      if (err instanceof ApiError && err.status && err.status !== 500) throw err;
      networkErrors += 1;
      if (networkErrors > 12) throw err; // about a minute without a reply
      await sleep(intervalMs);
      continue;
    }
    onProgress?.(job);
    if (job.status === "done") return job.result;
    if (job.status === "failed") {
      throw new ApiError(500, "GENERATION_FAILED", job.error || "Generation failed. You have not been charged.", job);
    }
    await sleep(intervalMs);
  }
}

// ---------- Billing ----------
export const getBillingStatus = () => request("/api/billing/status");

// Sends the browser to Pesapal's hosted payment page.
export async function startCheckout(productKey) {
  const data = await request("/api/payment/checkout", {
    method: "POST",
    body: JSON.stringify({ product_key: productKey }),
  });
  window.location.href = data.checkout_url;
}

// Asks the server to confirm a Pesapal payment when the customer comes back from the payment page.
export const verifyPesapalPayment = (orderTrackingId) =>
  request(`/api/payment/verify?orderTrackingId=${encodeURIComponent(orderTrackingId)}`);

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
export const register = ({ email, password, full_name, turnstile_token }) =>
  request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name, turnstile_token }),
  });

export const login = ({ email, password }) =>
  request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const logout = () => request("/api/auth/logout", { method: "POST" });

export const requestPasswordReset = (email) =>
  request("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });

export const updatePassword = (password) =>
  request("/api/auth/update-password", { method: "POST", body: JSON.stringify({ password }) });

// Direct USDT payment on the TRON network (TRC20).
// Returns { tx_ref, address, network, token, amount, expires_at }.
export const startUsdtPayment = (productKey) =>
  request("/api/payment/usdt/checkout", {
    method: "POST",
    body: JSON.stringify({ product_key: productKey }),
  });

// Asks the server to look for the payment on the blockchain.
// Returns { state: "paid" | "waiting" | "expired" | "failed" }.
export const getUsdtPaymentStatus = (txRef) =>
  request(`/api/payment/usdt/status?tx_ref=${encodeURIComponent(txRef)}`);

// Mobile money (MTN or Airtel) with manual confirmation.
// network is "mtn" or "airtel". Returns { tx_ref, number, name, amount_ugx, reference }.
export const startMomoPayment = (productKey, network) =>
  request("/api/payment/momo/checkout", {
    method: "POST",
    body: JSON.stringify({ product_key: productKey, network }),
  });

// The customer enters the transaction ID from the confirmation SMS; the owner then approves the order.
export const submitMomoTransaction = (txRef, transactionId) =>
  request("/api/payment/momo/submit", {
    method: "POST",
    body: JSON.stringify({ tx_ref: txRef, transaction_id: transactionId }),
  });

// Returns { state: "pending" | "awaiting_review" | "paid" | "rejected" | "failed" }.
export const getMomoPaymentStatus = (txRef) =>
  request(`/api/payment/momo/status?tx_ref=${encodeURIComponent(txRef)}`);

// Records that a document was downloaded, printed or copied. It never blocks the action if it fails.
export function recordDocumentEvent(id, event) {
  if (!id) return;
  fetch(`/api/documents/${encodeURIComponent(id)}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}
