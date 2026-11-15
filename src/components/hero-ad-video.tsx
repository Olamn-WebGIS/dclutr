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
        style={{ width: 32, minWidth: 32, maxWidth: 32, height: 32, flex: "0 0 32px", padding: 0, borderRadius: "50%", background: "transparent", border: 0 }}
        aria-label={muted ? "Unmute advert" : "Mute advert"}
        aria-pressed={!muted}
        onClick={() => setMuted((isMuted) => !isMuted)}
      >
        <span className="hero-ad-mute-visual" aria-hidden="true">
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </span>
      </button>
    </div>
  );
}
