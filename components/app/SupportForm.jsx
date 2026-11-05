"use client";

import { useEffect, useState } from "react";
import { sendSupportRequest, isUnauthorized } from "@/lib/api/client";

const TOPICS = [
  ["search", "Literature search"],
  ["tools", "A planning tool"],
  ["document", "A document or preview"],
  ["payment", "A payment"],
  ["account", "My account"],
  ["other", "Something else"],
];

const field =
  "mt-1.5 w-full rounded-xl border border-[#C9CCC4] bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-[#BFE0D6] disabled:opacity-60";

// Help request form. /dashboard/help?topic=search&error=...&from=/dashboard/tools/... fills it in.
export default function SupportForm() {
  const [topic, setTopic] = useState("other");
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState("");
  const [page, setPage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (TOPICS.some(([k]) => k === p.get("topic"))) setTopic(p.get("topic"));
    if (p.get("error")) setErrorText(p.get("error").slice(0, 1000));
    setPage(p.get("from") || "");
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (sending) return;
    setProblem("");
    if (message.trim().length < 10) {
      setProblem("Please describe the problem in a sentence or two.");
      return;
    }
    setSending(true);
    try {
      await sendSupportRequest({ topic, message, page, error_text: errorText });
      setSent(true);
    } catch (err) {
      if (isUnauthorized(err)) window.location.href = "/login";
      else setProblem(err.message || "Your request could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div id="support" className="rounded-2xl bg-mint p-6">
        <h2 className="font-serif text-2xl font-medium">Thank you. We have your request.</h2>
        <p className="mt-2 text-[15px] text-brand-dark">
          We look into every request and reply by email, usually within one working day. You do not need to send it again.
        </p>
      </div>
    );
  }

  return (
    <form id="support" onSubmit={submit} noValidate className="scroll-mt-6 space-y-4 rounded-2xl border border-line bg-white p-6">
      <div>
        <h2 className="font-serif text-2xl font-medium">Get help</h2>
        <p className="mt-1 text-sm text-ink-soft">Tell us what happened. We reply by email, usually within one working day.</p>
      </div>
      <div>
        <label htmlFor="topic" className="block text-sm font-semibold">What is it about?</label>
        <select id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={sending} className={field}>
          {TOPICS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      {errorText && (
        <div className="rounded-xl bg-paper px-4 py-3 text-sm">
          <span className="font-semibold">The message you saw: </span>
          <span className="text-ink-soft">{errorText}</span>
        </div>
      )}
      <div>
        <label htmlFor="message" className="block text-sm font-semibold">What happened?</label>
        <textarea id="message" rows={5} maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)} disabled={sending} className={field}
          placeholder="For example: I searched for my research question and only one study came back, so I could not continue." />
      </div>
      <div aria-live="polite">{problem && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{problem}</p>}</div>
      <button type="submit" disabled={sending} className="rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        {sending ? "Sending..." : "Send to support"}
      </button>
    </form>
  );
}
