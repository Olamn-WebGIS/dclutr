"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

export function HeroAdVideo() {
  const [muted, setMuted] = useState(true);

  return (
    <div className="hero-ad-video">
      <video
        autoPlay
        loop
        muted={muted}
        playsInline
        preload="metadata"
        aria-label="D_clutr marketplace advert"
      >
        <source src="/d-clutr-campus-ad.mp4" type="video/mp4" />
      </video>
      <button
        className="hero-ad-mute"
        type="button"
        aria-label={muted ? "Unmute advert" : "Mute advert"}
        aria-pressed={!muted}
        onClick={() => setMuted((isMuted) => !isMuted)}
      >
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>
    </div>
  );
}
