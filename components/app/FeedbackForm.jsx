"use client";

import { useState } from "react";
import { sendSupportRequest, isUnauthorized } from "@/lib/api/client";

const QUESTIONS = [
  ["useful", "How useful was your proposal? (1 = not at all, 5 = very)"],
  ["recommend", "How likely are you to recommend Academic Catalyst to a classmate? (1 to 5)"],
];

export default function FeedbackForm() {
  const [scores, setScores] = useState({ useful: 0, recommend: 0 });
  const [good, setGood] = useState("");
  const [better, setBetter] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!scores.useful || !scores.recommend) {
      setError("Please choose a score for both questions.");
      return;
    }
    const message = [
      `Usefulness: ${scores.useful}/5`,
      `Would recommend: ${scores.recommend}/5`,
      `What worked: ${good.trim() || "(not given)"}`,
      `What to improve: ${better.trim() || "(not given)"}`,
    ].join("\n");
    setState("sending");
    try {
      await sendSupportRequest({ topic: "feedback", message, page: "/dashboard/feedback" });
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(isUnauthorized(err) ? "Please sign in first." : err.message);
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-line bg-white p-6">
        <p className="font-semibold">Thank you. Your feedback has reached us.</p>
        <p className="mt-2 text-ink-soft">If you found Academic Catalyst useful, please share it with a classmate.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-line bg-white p-6">
      {QUESTIONS.map(([key, label]) => (
        <fieldset key={key}>
          <legend className="font-semibold">{label}</legend>
          <div className="mt-3 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScores((s) => ({ ...s, [key]: n }))}
                aria-pressed={scores[key] === n}
                className={`h-10 w-10 rounded-full border text-sm font-semibold ${
                  scores[key] === n ? "border-brand bg-brand text-white" : "border-line bg-white text-ink"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <label className="block">
        <span className="font-semibold">What worked well?</span>
        <textarea value={good} onChange={(e) => setGood(e.target.value)} maxLength={1200} rows={3}
          className="mt-2 w-full rounded-lg border border-line p-3" />
      </label>
      <label className="block">
        <span className="font-semibold">What should we improve?</span>
        <textarea value={better} onChange={(e) => setBetter(e.target.value)} maxLength={1200} rows={3}
          className="mt-2 w-full rounded-lg border border-line p-3" />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={state === "sending"}
        className="rounded-full bg-brand px-6 py-3 font-semibold text-white disabled:opacity-60">
        {state === "sending" ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
