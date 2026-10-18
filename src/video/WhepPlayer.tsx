'use client';

import React, { useEffect, useRef } from 'react';
import { MediaMTXWebRTCReader } from './reader';

export interface WhepPlayerProps {
  url: string;
  fallbackUrl?: string | null;
  playoutDelaySec?: number;
  onVideo?: (v: HTMLVideoElement) => void;
  onReader?: (r: MediaMTXWebRTCReader | null) => void;
  onFail?: () => void;
  className?: string;
}

export function WhepPlayer({
  url,
  fallbackUrl,
  playoutDelaySec,
  onVideo,
  onReader,
  onFail,
  className,
}: WhepPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onVideoRef = useRef(onVideo);
  const onReaderRef = useRef(onReader);
  const onFailRef = useRef(onFail);
  const playoutDelayRef = useRef(playoutDelaySec);

  useEffect(() => {
    onVideoRef.current = onVideo;
    onReaderRef.current = onReader;
    onFailRef.current = onFail;
    playoutDelayRef.current = playoutDelaySec;
  }, [onVideo, onReader, onFail, playoutDelaySec]);

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
            const delaySec = playoutDelayRef.current;
            const receiver = evt.receiver as
              | (RTCRtpReceiver & {
                  playoutDelayHint?: number;
                  jitterBufferTarget?: number;
                })
              | undefined;
            if (receiver && typeof delaySec === 'number' && delaySec >= 0) {
              try {
                if ('playoutDelayHint' in receiver) {
                  receiver.playoutDelayHint = delaySec;
                }
                if ('jitterBufferTarget' in receiver) {
                  receiver.jitterBufferTarget = delaySec * 1000;
                }
              } catch {
                // Ignore if unsupported by browser
              }
            }
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
