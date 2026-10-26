"use client";

import { useEffect, useState } from "react";

const EMPTY = {
  full_name: "",
  position: "",
  affiliation: "",
  registration_number: "",
  programme: "",
  supervisors: "",
};

// Details typed at registration are kept here until the first sign in, then saved.
export const PENDING_COVER_KEY = "ac_pending_cover";

const FIELDS = [
  ["full_name", "Full name", "As it should appear on the cover page"],
  ["position", "Position or title", "For example: Assistant Lecturer, Consultant"],
  ["affiliation", "Organisation or department", "For example: Faculty of Veterinary Medicine, Makerere University"],
  ["registration_number", "Registration or staff number", "Optional"],
  ["programme", "Programme or degree", "Optional, for students"],
  ["supervisors", "Supervisor(s)", "Optional"],
];

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-60";

async function postProfile(values) {
  const res = await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || "Could not save your details.");
  return data.profile;
}

export default function CoverDetailsPanel() {
  const [values, setValues] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!active || !res.ok) return;

        let profile = { ...EMPTY, ...data.profile };

        // Details typed at registration before the first sign in are used only if they belong to this same
        // email address, and only to fill boxes that are still empty. Old leftovers are thrown away.
        let pending = null;
        try {
          const raw = localStorage.getItem(PENDING_COVER_KEY);
          if (raw) pending = JSON.parse(raw);
        } catch {
          // ignore unreadable storage
        }
        if (pending) {
          const sameAccount =
            String(pending.email || "").toLowerCase() === String(profile.email || "").toLowerCase();
          if (sameAccount && pending.details) {
            const filled = Object.fromEntries(
              Object.entries(pending.details).filter(([key, value]) => value && !profile[key])
            );
            if (Object.keys(filled).length > 0) {
              try {
                profile = { ...EMPTY, ...(await postProfile({ ...profile, ...filled })) };
              } catch {
                // keep going; the customer can type them in
              }
            }
          }
          try {
            localStorage.removeItem(PENDING_COVER_KEY);
          } catch {
            // ignore
          }
        }

        if (!active) return;
        setValues(profile);
        setOpen(!profile.full_name || !profile.affiliation);
      } catch {
        // The panel simply stays empty if the details cannot be loaded.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await postProfile(values);
      setValues({ ...EMPTY, ...saved });
      setMessage("Saved. Your next documents will use these details.");
    } catch (err) {
      setError(err.message || "Could not save your details.");
    } finally {
      setSaving(false);
    }
  }

  const complete = Boolean(values.full_name && values.affiliation);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Cover page details</h2>
          <p className="mt-1 text-xs text-slate-600">
            Used on the front page of your documents, so they are ready to print.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {loading ? "Loading" : complete ? "Complete" : "Add details"}
        </span>
      </div>

      {!loading && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 text-xs font-medium text-indigo-600 hover:underline"
        >
          {open ? "Hide" : "Edit details"}
        </button>
      )}

      {open && (
        <form onSubmit={save} className="mt-4 space-y-3">
          {FIELDS.map(([key, label, hint]) => (
            <div key={key}>
              <label htmlFor={`cover_${key}`} className="block text-sm font-medium text-slate-700">
                {label}
              </label>
              <input
                id={`cover_${key}`}
                type="text"
                maxLength={200}
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                disabled={saving}
                placeholder={hint}
                className={inputClass}
              />
            </div>
          ))}

          <div aria-live="polite">
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save details"}
          </button>
        </form>
      )}
    </section>
  );
}
