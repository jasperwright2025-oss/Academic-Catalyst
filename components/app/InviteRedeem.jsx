"use client";

import { useEffect, useState } from "react";

// "Have an invite code?" box for people who already have an account (added 23 Nov 2026).
export default function InviteRedeem({ onRedeemed }) {
  const [code, setCode] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done
  const [message, setMessage] = useState("");

  // Opening /dashboard?invite=CODE fills the box in.
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("invite");
      if (fromUrl) setCode(fromUrl.trim().toUpperCase().slice(0, 32));
    } catch {
      // ignore
    }
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/invites/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(data.message || (res.ok ? "Invite accepted." : "That code did not work."));
      setState(res.ok ? "done" : "idle");
      if (res.ok && onRedeemed) onRedeemed();
    } catch {
      setState("idle");
      setMessage("Could not reach the server. Please try again.");
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[#F2A93B] bg-[#FFF6E8] p-5">
      <p className="font-semibold">Have an invite code?</p>
      <p className="mt-1 text-sm text-slate-600">Enter it here to add one free full proposal to your account.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="AC-XXXXXX"
          maxLength={32}
          disabled={state !== "idle"}
          aria-label="Invite code"
          className="w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
        />
        <button
          type="submit"
          disabled={state !== "idle" || !code.trim()}
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {state === "sending" ? "Checking…" : state === "done" ? "Added" : "Use code"}
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-slate-700">{message}</p>}
    </form>
  );
}
