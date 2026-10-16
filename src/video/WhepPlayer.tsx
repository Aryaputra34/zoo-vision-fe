'use client';

import React, { useEffect, useRef } from 'react';
import { MediaMTXWebRTCReader } from './reader';

export interface WhepPlayerProps {
  url: string;
  onVideo?: (v: HTMLVideoElement) => void;
  onFail?: () => void;
  className?: string;
}

export function WhepPlayer({ url, onVideo, onFail, className }: WhepPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && onVideo) {
      onVideo(videoRef.current);
    }
  }, [onVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    let closed = false;
    let hasFrame = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const triggerFail = () => {
      if (!closed) {
        onFail?.();
      }
    };

    // 10s watchdog: onFail after 10 s without a playing frame
    timeoutId = setTimeout(() => {
      if (!hasFrame && !closed) {
        triggerFail();
      }
    }, 10_000);

    const onFrame = () => {
      if (!hasFrame) {
        hasFrame = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    };

    // Use requestVideoFrameCallback if available for frame-accurate detection
    let rVfcId: number | null = null;
    const anyVideo = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (id: number) => void;
    };

    if (typeof anyVideo.requestVideoFrameCallback === 'function') {
      const checkFrame = () => {
        onFrame();
        if (!closed && !hasFrame && typeof anyVideo.requestVideoFrameCallback === 'function') {
          rVfcId = anyVideo.requestVideoFrameCallback(checkFrame);
        }
      };
      rVfcId = anyVideo.requestVideoFrameCallback(checkFrame);
    }

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

    let reader: MediaMTXWebRTCReader | null = null;

    try {
      reader = new MediaMTXWebRTCReader({
        url,
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
          triggerFail();
        },
      });
    } catch {
      triggerFail();
    }

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
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        if (typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((track) => track.stop());
        }
        video.srcObject = null;
      }
    };
  }, [url, onFail]);

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
