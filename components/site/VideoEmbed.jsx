"use client";

import { useState } from "react";

// Shows the video's thumbnail and loads the YouTube player only when it is clicked,
// so the home page stays fast and no YouTube cookies are set until then.
export default function VideoEmbed({ id, title, poster }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[20px] border border-line bg-ink shadow-[0_24px_48px_-32px_rgba(16,32,58,0.45)]">
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 h-full w-full" aria-label={`Play: ${title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" className="h-full w-full object-cover" />
          <span className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand text-3xl text-white shadow-lg transition group-hover:scale-105 group-hover:bg-brand-dark">
            ▶
          </span>
        </button>
      )}
    </div>
  );
}
