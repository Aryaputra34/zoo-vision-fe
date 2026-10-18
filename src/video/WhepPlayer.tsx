'use client';

import React, { useEffect, useRef } from 'react';
import { MediaMTXWebRTCReader } from './reader';

export interface WhepPlayerProps {
  url: string;
  fallbackUrl?: string | null;
  onVideo?: (v: HTMLVideoElement) => void;
  /** The first frame of an attempt is playing. */
  onPlaying?: () => void;
  onReader?: (r: MediaMTXWebRTCReader | null) => void;
  onFail?: () => void;
  className?: string;
}

export function WhepPlayer({
  url,
  fallbackUrl,
  onVideo,
  onPlaying,
  onReader,
  onFail,
  className,
}: WhepPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onVideoRef = useRef(onVideo);
  const onPlayingRef = useRef(onPlaying);
  const onReaderRef = useRef(onReader);
  const onFailRef = useRef(onFail);

  useEffect(() => {
    onVideoRef.current = onVideo;
    onPlayingRef.current = onPlaying;
    onReaderRef.current = onReader;
    onFailRef.current = onFail;
  }, [onVideo, onPlaying, onReader, onFail]);

  useEffect(() => {
    if (videoRef.current) {
      onVideoRef.current?.(videoRef.current);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    const candidates =
      fallbackUrl && fallbackUrl !== url ? [url, fallbackUrl] : [url];

    let closed = false;
    let hasFrame = false;
    let currentIdx = 0;
    let failedCurrentAttempt = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let rVfcId: number | null = null;
    let reader: MediaMTXWebRTCReader | null = null;

    const anyVideo = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (id: number) => void;
    };

    const clearStream = () => {
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        if (typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((track) => track.stop());
        }
        video.srcObject = null;
      }
    };

    const onFrame = () => {
      if (!hasFrame) {
        hasFrame = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        onPlayingRef.current?.();
      }
    };

    const armFrameCallback = () => {
      if (rVfcId !== null && typeof anyVideo.cancelVideoFrameCallback === 'function') {
        anyVideo.cancelVideoFrameCallback(rVfcId);
        rVfcId = null;
      }
      if (typeof anyVideo.requestVideoFrameCallback === 'function') {
        const checkFrame = () => {
          onFrame();
          if (!closed && !hasFrame && typeof anyVideo.requestVideoFrameCallback === 'function') {
            rVfcId = anyVideo.requestVideoFrameCallback(checkFrame);
          }
        };
        rVfcId = anyVideo.requestVideoFrameCallback(checkFrame);
      }
    };

    const startCandidate = (candidateUrl: string) => {
      if (closed) return;
      hasFrame = false;
      failedCurrentAttempt = false;

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (reader) {
        reader.close();
        reader = null;
      }
      clearStream();
      armFrameCallback();

      // 10s watchdog: advance to fallbackUrl or call onFail after 10 s without a playing frame
      timeoutId = setTimeout(() => {
        if (!hasFrame && !closed) {
          handleAttemptFail();
        }
      }, 10_000);

      try {
        reader = new MediaMTXWebRTCReader({
          url: candidateUrl,
          onTrack: (evt: RTCTrackEvent) => {
            if (closed) return;
            if (videoRef.current && evt.streams && evt.streams[0]) {
              videoRef.current.srcObject = evt.streams[0];
              videoRef.current.play().catch(() => {
                // Browser may defer playback
              });
            }
          },
          onError: () => {
            handleAttemptFail();
          },
        });
        onReaderRef.current?.(reader);
      } catch {
        handleAttemptFail();
      }
    };

    const handleAttemptFail = () => {
      if (closed || failedCurrentAttempt) return;
      failedCurrentAttempt = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (reader) {
        reader.close();
        reader = null;
      }
      clearStream();

      if (currentIdx + 1 < candidates.length) {
        currentIdx += 1;
        startCandidate(candidates[currentIdx]);
      } else {
        onReaderRef.current?.(null);
        onFailRef.current?.();
      }
    };

    const handlePlaying = () => {
      onFrame();
    };

    const handleTimeUpdate = () => {
      if (video.currentTime > 0) {
        onFrame();
      }
    };

    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);

    startCandidate(candidates[0]);

    return () => {
      closed = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (rVfcId !== null && typeof anyVideo.cancelVideoFrameCallback === 'function') {
        anyVideo.cancelVideoFrameCallback(rVfcId);
      }
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      if (reader) {
        reader.close();
      }
      onReaderRef.current?.(null);
      clearStream();
    };
  }, [url, fallbackUrl]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={className}
    />
  );
}

export default WhepPlayer;
