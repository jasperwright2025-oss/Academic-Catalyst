"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateDocument,
  getBillingStatus,
  listDocuments,
  getDocument,
  deleteDocument,
  unlockDocument,
  startCheckout,
  startCryptoCheckout,
  verifyPesapalPayment,
  logout,
  isUnauthorized,
  isPaywall,
  isRateLimited,
  PAYWALL_OFFERS,
} from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PAGE_SIZE = 10;
const MAX_INPUT_BYTES = 150 * 1024; // keep in step with the limit in /api/generate

const ACTIONS = [
  {
    value: "generate_proposal",
    label: "Research Proposal",
    description: "A full First-Class proposal with literature review, methodology, ethics, timeline, references and ready-to-use data tools.",
    paywall: "tier_1",
  },
  {
    value: "simulate_data",
    label: "Data Simulation",
    description: "A 12-part package of clearly labelled simulated data and analysis, built from your approved proposal.",
    paywall: "tier_2_data",
  },
  {
    value: "compile_dissertation",
    label: "Dissertation Report",
    description: "A full 5 to 6 chapter report from your proposal and data.",
    paywall: "tier_3_dissertation",
  },
];

const DOC_TYPE_LABELS = {
  proposal: "Proposal",
  field_data: "Field data",
  dissertation: "Dissertation",
};

// Display prices only. The server catalog (lib/payments/catalog.js) is the source of truth.
const PRICING = {
  once: [
    { key: "proposal_single", name: "Premium Proposal Draft", price: 80, blurb: "One complete research proposal." },
    { key: "data_simulation_single", name: "Empirical Field Data Simulation", price: 135, blurb: "One full data generation run." },
    { key: "dissertation_single", name: "Distinction-Grade Dissertation Report", price: 540, blurb: "One complete dissertation report." },
  ],
  monthly: [
    { key: "proposal_architect", name: "Proposal Architect", price: 70, blurb: "5 proposals every month." },
    { key: "data_suite", name: "Data Suite", price: 110, blurb: "5 proposals plus the data simulation engine." },
    { key: "consultant_enterprise", name: "Consultant Enterprise", price: 400, blurb: "Unlimited proposals, 3 dissertations and data simulation." },
  ],
};

// Monthly allotments, used only to scale the credit gauges.
const ALLOTMENT = {
  proposals: { proposal_architect: 5, data_suite: 5 },
  dissertations: { consultant_enterprise: 3 },
};

const BANNER_STYLES = {
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-60";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function fileSlug(text) {
  return (
    (text || "document")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "document"
  );
}

function useEscape(handler) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && handler();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}

// ---------------------------------------------------------------------------
// Credit gauge
// ---------------------------------------------------------------------------
function CreditGauge({ label, remaining, max, unlimited, unlimitedLabel = "Unlimited", note }) {
  const pct = unlimited
    ? 100
    : Math.min(100, Math.round((remaining / Math.max(max, remaining, 1)) * 100));
  const barColor = unlimited ? "bg-emerald-500" : remaining > 0 ? "bg-indigo-500" : "bg-slate-300";

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-semibold text-slate-900">
          {unlimited ? unlimitedLabel : remaining}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paywall modal (tabs: pay once / monthly plans; methods: cards + mobile money, crypto)
// ---------------------------------------------------------------------------
function PaywallModal({ target, onClose, onUnauthorized }) {
  const offer = target ? PAYWALL_OFFERS[target] : null;
  const highlighted = offer ? [offer.single, offer.subscription] : [];

  const [tab, setTab] = useState("once");
  const [method, setMethod] = useState("flutterwave");
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState("");

  useEscape(onClose);

  // Crypto is one-time only: recurring billing needs a card.
  const effectiveMethod = tab === "monthly" ? "flutterwave" : method;

  async function pay(product) {
    if (busyKey) return;
    setError("");
    setBusyKey(product.key);
    try {
      if (effectiveMethod === "crypto") {
        await startCryptoCheckout(product.key);
      } else {
        await startCheckout(product.key);
      }
      // On success the browser navigates to the payment page.
    } catch (err) {
      if (isUnauthorized(err)) {
        onUnauthorized();
        return;
      }
      setError(err.message || "Could not start the payment. Please try again.");
      setBusyKey(null);
    }
  }

  const methodTile = (id, title, detail, disabled) => (
    <button
      type="button"
      role="radio"
      aria-checked={effectiveMethod === id}
      disabled={disabled}
      onClick={() => setMethod(id)}
      className={`rounded-xl border p-3 text-left transition ${
        effectiveMethod === id
          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
          : "border-slate-200 bg-white hover:border-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span className="block text-sm font-semibold text-slate-900">{title}</span>
      <span className="mt-0.5 block text-xs text-slate-600">{detail}</span>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:max-w-3xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="paywall-title" className="text-xl font-semibold text-slate-900">
              {offer ? offer.title : "Add credits or upgrade your plan"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Pay once for a single document, or subscribe for a monthly allowance.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div role="tablist" className="mt-5 inline-flex rounded-lg bg-slate-100 p-1">
          {[
            ["once", "Pay once"],
            ["monthly", "Monthly plans"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Payment method */}
        <div role="radiogroup" aria-label="Payment method" className="mt-4 grid gap-3 sm:grid-cols-2">
          {methodTile("flutterwave", "Cards and mobile money", "Visa, Mastercard and mobile money wallets, paid in USD or your local currency.", false)}
          {methodTile(
            "crypto",
            "Crypto (USDT)",
            tab === "monthly" ? "Available for one-time purchases only." : "Pay with USDT through Binance Pay.",
            tab === "monthly"
          )}
        </div>
        {tab === "monthly" && (
          <p className="mt-2 text-xs text-slate-500">
            Monthly plans are paid by card. Choose automatic renewal on the payment page, or pay again each month.
          </p>
        )}

        {/* Products */}
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {PRICING[tab].map((product) => {
            const isHighlighted = highlighted.includes(product.key);
            return (
              <div
                key={product.key}
                className={`flex flex-col rounded-xl border p-4 ${
                  isHighlighted ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"
                }`}
              >
                {isHighlighted && (
                  <span className="mb-2 w-fit rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    Recommended
                  </span>
                )}
                <h3 className="text-sm font-semibold text-slate-900">{product.name}</h3>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  ${product.price}
                  {tab === "monthly" && <span className="text-sm font-normal text-slate-500"> /month</span>}
                </p>
                <p className="mt-2 flex-1 text-sm text-slate-600">{product.blurb}</p>
                <button
                  type="button"
                  onClick={() => pay(product)}
                  disabled={Boolean(busyKey)}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyKey === product.key ? "Redirecting..." : `Pay $${product.price}`}
                </button>
              </div>
            );
          })}
        </div>

        <div aria-live="polite">
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Prices are in USD. You will be taken to a secure hosted payment page and returned here afterwards.
        </p>
      </div>
    </div>
  );
}

function printText(title, text) {
  const win = window.open("", "_blank");
  if (!win) return false;
  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  win.document.write(
    `<!doctype html><html><head><title>${esc(title)}</title><style>body{font-family:Georgia,serif;line-height:1.6;max-width:760px;margin:40px auto;padding:0 20px;white-space:pre-wrap;color:#111}</style></head><body>${esc(text)}</body></html>`
  );
  win.document.close();
  win.focus();
  win.print();
  return true;
}

// ---------------------------------------------------------------------------
// Locked preview: the first pages are readable, the rest is behind an unlock button
// ---------------------------------------------------------------------------
function LockedPreview({ text, sections, totalWords, canUseCredit, unlocking, onUnlock, error }) {
  const shownSections = (sections || []).slice(0, 12);
  const extra = (sections || []).length - shownSections.length;

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg bg-white">
        <div className="max-h-96 overflow-hidden whitespace-pre-wrap p-4 text-sm leading-relaxed text-slate-800">
          {text}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
          style={{ background: "linear-gradient(to top, #ffffff, rgba(255,255,255,0))" }}
        />
      </div>

      <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <p className="text-sm font-semibold text-indigo-900">
          This is a free preview{totalWords ? `. The full document is about ${totalWords.toLocaleString()} words.` : "."}
        </p>
        <p className="mt-1 text-xs text-indigo-800">
          Unlock it to read everything, then copy, download or print the complete document.
        </p>

        {shownSections.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {shownSections.map((title) => (
              <li key={title} className="flex items-start gap-2">
                <span aria-hidden="true">🔒</span>
                <span>{title}</span>
              </li>
            ))}
            {extra > 0 && <li className="text-xs text-slate-500">and {extra} more sections</li>}
          </ul>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onUnlock}
          disabled={unlocking}
          className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {unlocking
            ? "Unlocking..."
            : canUseCredit
            ? "Unlock the full proposal (uses 1 proposal credit)"
            : "Unlock the full proposal"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Document viewer modal
// ---------------------------------------------------------------------------
function DocumentModal({ docId, onClose, onUnauthorized, onChanged, onPaywall, canUseCredit }) {
  const [doc, setDoc] = useState(null);
  const [locked, setLocked] = useState(false);
  const [lockedMeta, setLockedMeta] = useState({ sections: [], totalWords: null });
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEscape(onClose);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getDocument(docId);
        if (!active) return;
        setDoc(res.document);
        setLocked(Boolean(res.locked));
        setLockedMeta({ sections: res.locked_sections || [], totalWords: res.total_words || null });
      } catch (err) {
        if (!active) return;
        if (isUnauthorized(err)) onUnauthorized();
        else setError(err.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [docId, onUnauthorized]);

  async function unlock() {
    if (unlocking) return;
    if (!canUseCredit) {
      onPaywall?.();
      return;
    }
    setUnlocking(true);
    setUnlockError("");
    try {
      const res = await unlockDocument(docId);
      setDoc(res.document);
      setLocked(false);
      onChanged?.();
    } catch (err) {
      if (isUnauthorized(err)) onUnauthorized();
      else if (isPaywall(err)) onPaywall?.();
      else setUnlockError(err.message || "Could not unlock the document.");
    } finally {
      setUnlocking(false);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(doc.generated_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to the clipboard.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Document"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {doc?.research_topic || "Document"}
            </h2>
            {doc && (
              <p className="text-sm text-slate-600">
                {DOC_TYPE_LABELS[doc.document_type] || doc.document_type} · {formatDate(doc.created_at)}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            ✕
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {!doc && !error && <p className="text-sm text-slate-500">Loading...</p>}
          {doc && locked && (
            <LockedPreview
              text={doc.generated_content}
              sections={lockedMeta.sections}
              totalWords={lockedMeta.totalWords}
              canUseCredit={canUseCredit}
              unlocking={unlocking}
              onUnlock={unlock}
              error={unlockError}
            />
          )}
          {doc && !locked && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {doc.generated_content}
            </div>
          )}
        </div>

        {doc && !locked && (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={copyText}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied ? "Copied" : "Copy text"}
            </button>
            <button
              type="button"
              onClick={() =>
                downloadText(`${fileSlug(doc.research_topic || doc.document_type)}.txt`, doc.generated_content)
              }
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Download .txt
            </button>
            <button
              type="button"
              onClick={() => printText(doc.research_topic || "Document", doc.generated_content)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Print
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const router = useRouter();

  // Billing and documents
  const [billing, setBilling] = useState(null);
  const [billingError, setBillingError] = useState("");
  const [docs, setDocs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState("");
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");

  // Generator form
  const [action, setAction] = useState("generate_proposal");
  const [topic, setTopic] = useState("");
  const [institution, setInstitution] = useState("");
  const [sample, setSample] = useState("");
  const [uploadedProposal, setUploadedProposal] = useState("");
  const [uploadedFieldData, setUploadedFieldData] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [result, setResult] = useState(null);
  const [resultCopied, setResultCopied] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  // Overlays and banners
  const [paywall, setPaywall] = useState(null); // { target } or null
  const [viewDocId, setViewDocId] = useState(null);
  const [banner, setBanner] = useState(null); // { kind, text }

  const goToLogin = useCallback(() => {
    router.push("/login");
    router.refresh();
  }, [router]);

  const refreshBilling = useCallback(async () => {
    try {
      const status = await getBillingStatus();
      setBilling(status);
      setBillingError("");
      return status;
    } catch (err) {
      if (isUnauthorized(err)) goToLogin();
      else setBillingError(err.message);
      return null;
    }
  }, [goToLogin]);

  const refreshDocs = useCallback(
    async (pageNumber, type) => {
      setDocsLoading(true);
      setDocsError("");
      try {
        const res = await listDocuments({ page: pageNumber, limit: PAGE_SIZE, type: type || undefined });
        setDocs(res.documents);
        setPagination(res.pagination);
      } catch (err) {
        if (isUnauthorized(err)) goToLogin();
        else setDocsError(err.message);
      } finally {
        setDocsLoading(false);
      }
    },
    [goToLogin]
  );

  useEffect(() => {
    refreshBilling();
  }, [refreshBilling]);

  useEffect(() => {
    refreshDocs(page, typeFilter);
  }, [page, typeFilter, refreshDocs]);

  // Returning from the payment page: /dashboard?payment=callback&status=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trackingId = params.get("OrderTrackingId"); // added by Pesapal when the customer returns
    const isReturn = params.get("payment") === "callback" || Boolean(trackingId);
    const isCancelled = params.get("payment") === "cancelled" || params.get("status") === "cancelled";
    if (!isReturn && !isCancelled) return;

    if (isCancelled) {
      setBanner({ kind: "warning", text: "The payment was cancelled. You have not been charged." });
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    let cancelled = false;
    setBanner({ kind: "info", text: "Confirming your payment..." });

    (async () => {
      if (trackingId) {
        try {
          await verifyPesapalPayment(trackingId);
        } catch {
          // The notification from Pesapal may still arrive; keep checking below.
        }
      }
      for (let i = 0; i < 10 && !cancelled; i++) {
        const status = await refreshBilling();
        const latest = status?.recent_transactions?.[0];
        if (latest && String(latest.status).toLowerCase() === "successful") {
          if (!cancelled) {
            setBanner({ kind: "success", text: "Payment confirmed. Your credits have been updated. Open a locked document in the list below and press Unlock." });
            window.history.replaceState(null, "", window.location.pathname);
          }
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      if (!cancelled) {
        setBanner({
          kind: "info",
          text: "Your payment is still being processed. Credits usually appear within a minute, so please refresh shortly.",
        });
        window.history.replaceState(null, "", window.location.pathname);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshBilling]);

  // ----- Actions -----
  async function handleGenerate(event) {
    event.preventDefault();
    if (generating) return;
    setGenError("");
    setResult(null);

    const current = ACTIONS.find((a) => a.value === action);

    if (action === "generate_proposal" && !topic.trim()) {
      setGenError("Please enter your research topic.");
      return;
    }
    if (action !== "generate_proposal" && !uploadedProposal.trim()) {
      setGenError("Please paste your approved research proposal.");
      return;
    }
    if (action === "compile_dissertation" && !uploadedFieldData.trim()) {
      setGenError("Please paste your field notes and data sets.");
      return;
    }

    const totalBytes = new TextEncoder().encode(
      [topic, institution, sample, uploadedProposal, uploadedFieldData].join("")
    ).length;
    if (totalBytes > MAX_INPUT_BYTES) {
      setGenError(`Your input is too large. Please keep the total under ${Math.round(MAX_INPUT_BYTES / 1024)} KB.`);
      return;
    }

    // Skip the round trip when we already know the user has no access.
    if (billing?.can_generate?.[action] === false) {
      setPaywall({ target: current.paywall });
      return;
    }

    const payload = {
      action_type: action,
      research_topic: topic.trim(),
      target_institution: institution.trim(),
      writing_sample: sample.trim(),
    };
    if (action !== "generate_proposal") payload.uploaded_proposal = uploadedProposal;
    if (action === "compile_dissertation") payload.uploaded_field_data = uploadedFieldData;

    setGenerating(true);
    try {
      const data = await generateDocument(payload);
      setResult({
        label: current.label,
        locked: Boolean(data.locked),
        text: data.locked ? data.preview : data.payload,
        documentId: data.document_id,
        sections: data.locked_sections || [],
        totalWords: data.total_words || null,
      });
      setUnlockError("");
      refreshBilling();
      if (page !== 1) setPage(1);
      else refreshDocs(1, typeFilter);
    } catch (err) {
      if (isUnauthorized(err)) {
        goToLogin();
      } else if (isPaywall(err)) {
        setPaywall({ target: err.data?.target || current.paywall });
      } else if (isRateLimited(err)) {
        setGenError(err.message || "Please wait a few seconds before requesting another document.");
      } else {
        setGenError(err.message || "Generation failed. Please try again.");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Delete "${doc.research_topic}"? This cannot be undone.`)) return;
    try {
      await deleteDocument(doc.id);
      if (docs.length === 1 && page > 1) setPage(page - 1);
      else refreshDocs(page, typeFilter);
    } catch (err) {
      if (isUnauthorized(err)) goToLogin();
      else setDocsError(err.message);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Redirect regardless; the middleware will bounce a still-valid session back if needed.
    }
    goToLogin();
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(result.text);
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      setGenError("Could not copy to the clipboard.");
    }
  }

  async function handleUnlockResult() {
    if (!result?.documentId || unlocking) return;
    if (billing && !hasProposalCredit) {
      setPaywall({ target: "tier_1" });
      return;
    }
    setUnlocking(true);
    setUnlockError("");
    try {
      const res = await unlockDocument(result.documentId);
      setResult((r) => ({ ...r, locked: false, text: res.document.generated_content, sections: [] }));
      refreshBilling();
      refreshDocs(page, typeFilter);
    } catch (err) {
      if (isUnauthorized(err)) goToLogin();
      else if (isPaywall(err)) setPaywall({ target: err.data?.target || "tier_1" });
      else setUnlockError(err.message || "Could not unlock the document.");
    } finally {
      setUnlocking(false);
    }
  }

  const currentAction = ACTIONS.find((a) => a.value === action);
  const plan = billing?.plan;
  const credits = billing?.credits;
  const hasProposalCredit = Boolean(
    credits && (credits.proposals.unlimited || credits.proposals.remaining > 0)
  );
  const previewOnly =
    action === "generate_proposal" &&
    Boolean(credits) &&
    !hasProposalCredit &&
    (credits.free_previews_remaining ?? 0) > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Academic Catalyst</h1>
          <div className="flex flex-wrap items-center gap-3">
            {plan && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  plan.is_subscribed ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
                }`}
              >
                {plan.name} plan
              </span>
            )}
            <button
              type="button"
              onClick={() => setPaywall({ target: null })}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Buy credits
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {banner && (
          <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${BANNER_STYLES[banner.kind]}`}>
            {banner.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Generator */}
          <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900">Workspace</h2>
            <p className="mt-1 text-sm text-slate-600">Choose what you would like to produce.</p>

            <form onSubmit={handleGenerate} className="mt-5 space-y-5" noValidate>
              <div role="radiogroup" aria-label="Document type" className="grid gap-3 sm:grid-cols-3">
                {ACTIONS.map((a) => {
                  const locked = billing?.can_generate?.[a.value] === false;
                  return (
                    <button
                      key={a.value}
                      type="button"
                      role="radio"
                      aria-checked={action === a.value}
                      disabled={generating}
                      onClick={() => setAction(a.value)}
                      className={`rounded-xl border p-3 text-left transition ${
                        action === a.value
                          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">{a.label}</span>
                        {locked && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                            Unlock
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-slate-600">{a.description}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="research_topic" className="block text-sm font-medium text-slate-700">
                    Research topic {action === "generate_proposal" && <span className="text-red-600">*</span>}
                  </label>
                  <input
                    id="research_topic"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={generating}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="target_institution" className="block text-sm font-medium text-slate-700">
                    Target institution
                  </label>
                  <input
                    id="target_institution"
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    disabled={generating}
                    className={fieldClass}
                  />
                </div>
              </div>

              {action !== "generate_proposal" && (
                <div>
                  <label htmlFor="uploaded_proposal" className="block text-sm font-medium text-slate-700">
                    Approved research proposal <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="uploaded_proposal"
                    rows={6}
                    value={uploadedProposal}
                    onChange={(e) => setUploadedProposal(e.target.value)}
                    disabled={generating}
                    placeholder="Paste the full text of your proposal."
                    className={fieldClass}
                  />
                </div>
              )}

              {action === "compile_dissertation" && (
                <div>
                  <label htmlFor="uploaded_field_data" className="block text-sm font-medium text-slate-700">
                    Field notes and data sets <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="uploaded_field_data"
                    rows={6}
                    value={uploadedFieldData}
                    onChange={(e) => setUploadedFieldData(e.target.value)}
                    disabled={generating}
                    placeholder="Paste your collected data and field notes."
                    className={fieldClass}
                  />
                </div>
              )}

              {action === "simulate_data" && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Disclaimer: the data generated here is simulated. It is for pilots, instrument testing and teaching. The participants are not real.
                </p>
              )}

              {action !== "simulate_data" && (
                <div>
                  <label htmlFor="writing_sample" className="block text-sm font-medium text-slate-700">
                    Writing sample <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    id="writing_sample"
                    rows={4}
                    value={sample}
                    onChange={(e) => setSample(e.target.value)}
                    disabled={generating}
                    placeholder="Paste a sample of your own writing (at least 100 characters) to match your voice."
                    className={fieldClass}
                  />
                </div>
              )}

              <div aria-live="polite">
                {genError && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {genError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={generating}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating
                  ? "Generating... this can take a minute or two"
                  : billing?.can_generate?.[action] === false
                  ? "Unlock to generate"
                  : previewOnly
                  ? "Generate free preview"
                  : `Generate ${currentAction.label}`}
              </button>
            </form>

            {result && (
              <div
                className={`mt-6 rounded-xl border p-4 ${
                  result.locked ? "border-indigo-200 bg-indigo-50/40" : "border-emerald-200 bg-emerald-50/50"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {result.locked ? `${result.label} preview` : `${result.label} ready`}
                  </h3>
                  {!result.locked && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={copyResult}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {resultCopied ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadText(`${fileSlug(topic || result.label)}.txt`, result.text)}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        Download .txt
                      </button>
                      <button
                        type="button"
                        onClick={() => printText(topic || result.label, result.text)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Print
                      </button>
                    </div>
                  )}
                </div>

                {result.locked ? (
                  <div className="mt-3">
                    <LockedPreview
                      text={result.text}
                      sections={result.sections}
                      totalWords={result.totalWords}
                      canUseCredit={hasProposalCredit}
                      unlocking={unlocking}
                      onUnlock={handleUnlockResult}
                      error={unlockError}
                    />
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-slate-600">A copy has been saved to your history below.</p>
                    <div className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-4 text-sm leading-relaxed text-slate-800">
                      {result.text}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Plan and credits */}
          <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Plan and credits</h2>

            {billingError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{billingError}</p>}
            {!billing && !billingError && <p className="mt-3 text-sm text-slate-500">Loading...</p>}

            {billing && (
              <>
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                  <p className="text-xs text-slate-600">
                    {plan.is_subscribed ? `$${plan.monthly_price_usd} per month` : "Pay as you go"}
                  </p>
                </div>

                <div className="mt-5 space-y-5">
                  <CreditGauge
                    label="Proposals"
                    remaining={credits.proposals.remaining}
                    unlimited={credits.proposals.unlimited}
                    max={ALLOTMENT.proposals[plan.tier] ?? 1}
                  />
                  <CreditGauge
                    label="Dissertations"
                    remaining={credits.dissertations.remaining}
                    unlimited={credits.dissertations.unlimited}
                    max={ALLOTMENT.dissertations[plan.tier] ?? 1}
                  />
                  <CreditGauge
                    label="Data simulations"
                    remaining={credits.data_simulations.remaining}
                    unlimited={credits.data_simulations.included_in_plan}
                    unlimitedLabel="Included"
                    max={1}
                    note={credits.data_simulations.included_in_plan ? "Included in your plan." : "Single purchases appear here."}
                  />
                </div>

                {credits.free_previews_remaining > 0 && (
                  <p className="mt-5 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                    {credits.free_previews_remaining} free {credits.free_previews_remaining === 1 ? "preview" : "previews"} left. A preview shows the first few pages of a proposal.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setPaywall({ target: null })}
                  className="mt-6 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  Add credits or upgrade
                </button>
              </>
            )}
          </aside>
        </div>

        {/* Documents history */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Your documents</h2>
            <select
              aria-label="Filter by type"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="">All types</option>
              <option value="proposal">Proposals</option>
              <option value="field_data">Field data</option>
              <option value="dissertation">Dissertations</option>
            </select>
          </div>

          {docsError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{docsError}</p>}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">Topic</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Institution</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className={docsLoading ? "opacity-50" : ""}>
                {docs.map((doc) => (
                  <tr key={doc.id} className="border-b border-slate-100">
                    <td className="max-w-xs truncate py-3 pr-4 font-medium text-slate-900">{doc.research_topic}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                      </span>
                      {doc.is_unlocked === false && (
                        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Locked
                        </span>
                      )}
                    </td>
                    <td className="max-w-[12rem] truncate py-3 pr-4 text-slate-600">{doc.target_institution}</td>
                    <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{formatDate(doc.created_at)}</td>
                    <td className="whitespace-nowrap py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setViewDocId(doc.id)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        {doc.is_unlocked === false ? "Preview" : "View"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc)}
                        className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!docsLoading && docs.length === 0 && !docsError && (
              <p className="py-10 text-center text-sm text-slate-500">
                No documents yet. Generate your first one above.
              </p>
            )}
          </div>

          {pagination && pagination.total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span>
                Page {pagination.page} of {pagination.total_pages} · {pagination.total} document
                {pagination.total === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || docsLoading}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.has_more || docsLoading}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {paywall && (
        <PaywallModal target={paywall.target} onClose={() => setPaywall(null)} onUnauthorized={goToLogin} />
      )}
      {viewDocId && (
        <DocumentModal
          docId={viewDocId}
          onClose={() => setViewDocId(null)}
          onUnauthorized={goToLogin}
          onChanged={() => {
            refreshBilling();
            refreshDocs(page, typeFilter);
          }}
          onPaywall={() => {
            setViewDocId(null);
            setPaywall({ target: "tier_1" });
          }}
          canUseCredit={hasProposalCredit}
        />
      )}
    </div>
  );
}
