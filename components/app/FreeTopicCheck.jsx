"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TurnstileWidget, { TURNSTILE_ENABLED } from "@/components/TurnstileWidget";
import TopicResult from "@/components/app/TopicResult";
import { runAnonymousTopicCheck, isRateLimited } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";

const LEVELS = ["Master's", "PhD", "Undergraduate", "Postgraduate diploma", "Professional or workplace study"];
const REGISTER_HREF = "/register?from=topic-validator";
const field =
  "mt-1.5 w-full rounded-xl border border-[#C9CCC4] bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-[#BFE0D6] disabled:opacity-60";

// One Topic validator check without an account, shown on /tools/topic-validator.
// Signed-in visitors are sent to the full tool in the dashboard instead.
export default function FreeTopicCheck() {
  const [signedIn, setSignedIn] = useState(null); // null while checking
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState(LEVELS[0]);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [used, setUsed] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    try {
      createClient()
        .auth.getSession()
        .then(({ data }) => active && setSignedIn(Boolean(data?.session)))
        .catch(() => active && setSignedIn(false));
    } catch {
      setSignedIn(false);
    }
    return () => {
      active = false;
    };
  }, []);

  if (signedIn) {
    return (
      <Link href="/dashboard/tools/topic-validator" className="inline-block rounded-full bg-brand px-6 py-4 font-semibold text-white transition hover:bg-brand-dark">
        Open the Topic validator
      </Link>
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (running) return;
    setError("");
    if (topic.trim().length < 10) {
      setError("Please describe your topic in at least a few words.");
      return;
    }
    if (TURNSTILE_ENABLED && !token) {
      setError("Please complete the security check first.");
      return;
    }
    setRunning(true);
    try {
      const data = await runAnonymousTopicCheck({ topic, level, turnstile_token: token });
      setResult(data.run);
      setTimeout(() => document.getElementById("free-check-result")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      if (isRateLimited(err)) setUsed(true);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setRunning(false);
      setResetKey((k) => k + 1); // a Turnstile token works only once
    }
  }

  const registerButton = (
    <Link href={REGISTER_HREF} className="inline-block rounded-full bg-brand px-6 py-4 font-semibold text-white transition hover:bg-brand-dark">
      Save this result and get your free checks: create a free account
    </Link>
  );

  if (result) {
    return (
      <div id="free-check-result" className="space-y-6">
        <TopicResult run={result} />
        {registerButton}
      </div>
    );
  }

  if (used) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-sand px-4 py-3 text-sm text-[#7A4A0C]">{error}</p>
        {registerButton}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[20px] border border-line bg-white p-6">
      <div>
        <label htmlFor="free-topic" className="block text-sm font-semibold">Your topic or working title</label>
        <textarea id="free-topic" rows={3} maxLength={600} value={topic} onChange={(e) => setTopic(e.target.value)} disabled={running} className={field}
          placeholder="For example: Mobile money use and saving behaviour among market vendors in Mbale" />
      </div>
      <div>
        <label htmlFor="free-level" className="block text-sm font-semibold">Level</label>
        <select id="free-level" value={level} onChange={(e) => setLevel(e.target.value)} disabled={running} className={field}>
          {LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      <TurnstileWidget onToken={setToken} resetKey={resetKey} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={running || signedIn === null} className="rounded-full bg-brand px-6 py-4 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60">
          {running ? "Checking your topic (about a minute)..." : "Run one free check"}
        </button>
        <Link href={REGISTER_HREF} className="text-sm font-semibold text-brand hover:text-brand-dark">or create a free account</Link>
      </div>
      <p className="text-xs text-muted">One check without an account. Create a free account to keep your results and run more checks.</p>
    </form>
  );
}
