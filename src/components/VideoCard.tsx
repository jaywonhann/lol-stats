"use client";

import { useState } from "react";

// 썸네일만 먼저 보여주고, 누르면 그 자리에서 영상 재생
export default function VideoCard({
  id,
  title,
  meta,
}: {
  id: string;
  title: string;
  meta: string;
}) {
  const [play, setPlay] = useState(false);
  return (
    <div className="min-w-0">
      <div className="relative aspect-video overflow-hidden rounded-md bg-black">
        {play ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlay(true)}
            className="group absolute inset-0"
            aria-label={title}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:opacity-80"
            />
            <span className="absolute inset-0 m-auto flex h-11 w-16 items-center justify-center rounded-xl bg-[#e62117] text-white shadow-lg">
              ▶
            </span>
          </button>
        )}
      </div>
      <a
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 line-clamp-2 text-sm font-medium hover:text-accent"
      >
        {title}
      </a>
      {meta && <div className="mt-0.5 truncate text-xs text-muted">{meta}</div>}
    </div>
  );
}
