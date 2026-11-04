"use client";

import Logo from "@/components/site/Logo";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { requestPasswordReset } from "@/lib/api/client";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-[#BFE0D6] disabled:opacity-60";

function ForgotPasswordForm() {
  const params = useSearchParams();
  const expired = params.get("error") === "link_expired";
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12 font-sans text-ink">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <Link href="/" className="mb-6 flex items-center gap-2 text-ink">
          <Logo />
          <span className="font-serif text-lg font-semibold">Academic Catalyst</span>
        </Link>
        <h1 className="font-serif text-3xl font-medium text-ink">Reset your password</h1>

        {sent ? (
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p>
              If an account exists for <span className="font-medium">{email.trim()}</span>, a reset link is on its way.
            </p>
            <p>
              Open the link on this device and in this browser. It expires after one hour. If it does not arrive within a
              few minutes, check your spam folder.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Enter the email address you registered with and we will send you a link to choose a new password.
            </p>
            {expired && (
              <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                That reset link has expired or was opened in a different browser. Please request a new one.
              </p>
            )}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className={inputClass}
                />
              </div>
              <div aria-live="polite">
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link href="/login" className="font-medium text-brand hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
