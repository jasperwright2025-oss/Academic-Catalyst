"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// Payments to approve: mobile money orders where the customer has entered a transaction ID.
export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyRef, setBusyRef] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/payments", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || "Could not load payments.");
        setPayments([]);
      } else {
        setPayments(data.payments || []);
      }
    } catch {
      setError("Could not load payments. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(payment, action) {
    const question =
      action === "approve"
        ? `Approve this payment?\n\nOnly approve it if you can see transaction ID ${payment.provider_reference} for UGX ${Number(payment.amount).toLocaleString("en-US")} in your ${payment.network} statement.`
        : `Reject this payment? The customer will not receive credits.`;
    if (!window.confirm(question)) return;

    setBusyRef(payment.tx_ref);
    setError("");
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx_ref: payment.tx_ref, action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setError(data?.message || "That did not work. Please try again.");
      await load();
    } catch {
      setError("That did not work. Please check your connection.");
    } finally {
      setBusyRef(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Mobile money payments to approve</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <Link href="/dashboard" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Dashboard
            </Link>
          </div>
        </div>

        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Approve a payment only after you have found the same transaction ID, with the same amount, in your own MTN or
          Airtel statement or confirmation message. A customer can type anything into the transaction ID box.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Network</th>
                <th className="px-4 py-3 font-medium">Amount (UGX)</th>
                <th className="px-4 py-3 font-medium">Transaction ID</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.tx_ref} className="border-b border-slate-100">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-900">{p.customer_email}</td>
                  <td className="px-4 py-3 text-slate-700">{p.product}</td>
                  <td className="px-4 py-3 text-slate-700">{p.network}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                    {Number(p.amount).toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-900">{p.provider_reference}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => act(p, "approve")}
                      disabled={busyRef === p.tx_ref}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => act(p, "reject")}
                      disabled={busyRef === p.tx_ref}
                      className="ml-2 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && payments.length === 0 && !error && (
            <p className="py-10 text-center text-sm text-slate-500">Nothing is waiting for approval.</p>
          )}
        </div>
      </div>
    </main>
  );
}
