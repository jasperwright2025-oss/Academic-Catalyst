"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register, login } from "@/lib/api/client";
import { PENDING_COVER_KEY } from "@/components/CoverDetailsPanel";

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    if (!fullName.trim()) return "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return "Please enter a valid email address.";
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
    }
    if (password !== confirmPassword) return "The two passwords do not match.";
    if (!agreed) return "Please confirm that you accept the Terms of Service and the Privacy Policy to continue.";
    return "";
  }

  const coverDetails = () => ({
    full_name: fullName.trim(),
    position: position.trim(),
    affiliation: affiliation.trim(),
  });

  // Saves the cover page details to the account (best effort, never blocks sign up).
  async function saveCoverDetails() {
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coverDetails()),
      });
    } catch {
      // The dashboard lets the customer add them later.
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const cleanEmail = email.trim();
    setSubmitting(true);

    // 1. Create the account
    try {
      await register({
        email: cleanEmail,
        password,
        full_name: fullName.trim(),
      });
    } catch (err) {
      setError(err.message || "We could not create your account. Please try again.");
      setSubmitting(false);
      return;
    }

    // 2. Sign in straight away. This fails if the project requires email
    //    confirmation first, in which case we show a message instead.
    try {
      await login({ email: cleanEmail, password });
      await saveCoverDetails();
      router.push("/dashboard");
      router.refresh();
    } catch {
      // Not signed in yet (email confirmation), so keep the details for the first visit to the dashboard.
      try {
        localStorage.setItem(PENDING_COVER_KEY, JSON.stringify(coverDetails()));
      } catch {
        // ignore
      }
      setAccountCreated(true);
      setSubmitting(false);
    }
  }

  if (accountCreated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-semibold text-slate-900">Your account is ready</h1>
          <p className="mt-3 text-sm text-slate-600">
            If email confirmation is required, please check your inbox and confirm your
            address first. Then you can sign in.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-700"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-60";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Start building your research proposals with Academic Catalyst.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-slate-700">
              Full name
            </label>
            <input
              id="full_name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={submitting}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="position" className="block text-sm font-medium text-slate-700">
              Position or title <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="position"
              type="text"
              autoComplete="organization-title"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              disabled={submitting}
              placeholder="For example: Assistant Lecturer"
              maxLength={200}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="affiliation" className="block text-sm font-medium text-slate-700">
              Organisation or department <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="affiliation"
              type="text"
              autoComplete="organization"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              disabled={submitting}
              placeholder="For example: Faculty of Veterinary Medicine, Makerere University"
              maxLength={200}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-500">
              These appear on the cover page of your documents. You can add more details later.
            </p>
          </div>

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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-500">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          </div>

          <div>
            <label htmlFor="confirm_password" className="block text-sm font-medium text-slate-700">
              Confirm password
            </label>
            <input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              className={inputClass}
            />
          </div>

          <label className="flex items-start gap-3 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={submitting}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <span>
              I accept the{" "}
              <Link href="/terms" target="_blank" className="font-medium text-indigo-600 hover:underline">
                Terms of Service
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-indigo-600 hover:underline">
                Privacy Policy
              </Link>
              , and I consent to my data being processed for the purpose of handling my requests.
            </span>
          </label>

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
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating your account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
