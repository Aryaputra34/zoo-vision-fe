'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Cctv } from 'lucide-react';
import { WhepPlayer } from './WhepPlayer';
import type { MediaMTXWebRTCReader } from './reader';

const STILL_EVERY_MS = 2000;
const RETRY_AFTER_MS = 5000;

export interface LiveVideoProps {
  cameraId: string;
  alt: string;
  /** The WHEP URL to play; null shows only the still. */
  url: string | null;
  fallbackUrl?: string | null;
  /** Shown when neither video nor a still is available. */
  emptyText: string;
  /** Drawn over the video, only while it really plays (never over the still, which is already annotated). */
  overlay?: (video: HTMLVideoElement, reader: MediaMTXWebRTCReader | null) => ReactNode;
}

// Live video over the 2 s still: the still shows until the first frame plays, and again while a failed player
// waits 5 s to retry (a MediaMTX restart, a camera that comes back).
export function LiveVideo({ cameraId, alt, url, fallbackUrl, emptyText, overlay }: LiveVideoProps) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [reader, setReader] = useState<MediaMTXWebRTCReader | null>(null);
  const [stillAt, setStillAt] = useState(() => Date.now());
  const [stillError, setStillError] = useState(false);
  const showStill = !url || !playing;

  useEffect(() => {
    if (!showStill) return;
    const timer = setInterval(() => setStillAt(Date.now()), STILL_EVERY_MS);
    return () => clearInterval(timer);
  }, [showStill]);

  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => {
      setFailed(false);
      setAttempt((n) => n + 1);
    }, RETRY_AFTER_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  return (
    <div className="relative size-full">
      {url && !failed && (
        <WhepPlayer
          key={attempt}
          url={url}
          fallbackUrl={fallbackUrl}
          onVideo={setVideo}
          onReader={setReader}
          onPlaying={() => setPlaying(true)}
          onFail={() => {
            setPlaying(false);
            setFailed(true);
          }}
          className={`absolute inset-0 size-full object-contain ${playing ? '' : 'opacity-0'}`}
        />
      )}
      {playing && video && overlay?.(video, reader)}
      {showStill && (
        <>
          {/* Stays mounted while hidden, so the next tick retries a still that failed once */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/v1/cameras/${cameraId}/frame?t=${stillAt}`}
            alt={alt}
            onError={() => setStillError(true)}
            onLoad={() => setStillError(false)}
            className={stillError ? 'hidden' : 'absolute inset-0 size-full object-contain'}
          />
          {stillError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-zinc-500">
              <Cctv className="mb-1 size-8 text-zinc-600" />
              <span className="text-[11px] font-bold">{emptyText}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
