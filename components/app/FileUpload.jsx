"use client";

import { useRef, useState } from "react";
import { ACCEPTED, fileToText } from "@/lib/client/fileText";

// An "Upload a file" button beside a paste box. The file's text is placed in the box,
// where the client can check and edit it. Several files can be added; each is labelled.
export default function FileUpload({ value, onChange, disabled, multiple = false, label = "Upload a file" }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function handle(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError("");
    setNote("");
    const parts = [];
    const read = [];
    for (const file of files) {
      try {
        const text = await fileToText(file);
        parts.push(files.length > 1 || multiple ? `=== File: ${file.name} ===\n${text}` : text);
        read.push(`${file.name} (${text.split(/\s+/).filter(Boolean).length.toLocaleString()} words)`);
      } catch (err) {
        setError(`${file.name}: ${err.message}`);
      }
    }
    if (parts.length) {
      const added = parts.join("\n\n");
      // A second upload adds to what is there; the first one replaces an empty box.
      onChange(multiple && value.trim() ? `${value.trim()}\n\n${added}` : added);
      setNote(`Added ${read.join(", ")}. Check the text below before you generate.`);
    }
    setBusy(false);
  }

  return (
    <div className="mt-2">
      <input ref={input} type="file" accept={ACCEPTED} multiple={multiple} onChange={handle} className="hidden" />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={disabled || busy}
          className="inline-flex items-center gap-2 rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-mint disabled:opacity-50"
        >
          {busy ? "Reading the file…" : `⬆ ${label}`}
        </button>
        <span className="text-xs text-slate-500">Word, PDF, Excel, CSV or text. Or paste below.</span>
      </div>
      {note && <p className="mt-2 text-xs text-brand-dark">{note}</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
