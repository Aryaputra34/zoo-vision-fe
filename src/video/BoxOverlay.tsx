'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useCameraBoxes } from '@/live/useCameraBoxes';
import { boxesAt } from './boxes-at';
import { VideoDelay } from './sync';
import { geometryOf } from './zones';
import type { MediaMTXWebRTCReader } from './reader';

export interface BoxOverlayProps {
  video: HTMLVideoElement;
  cameraId: string;
  settings?: unknown;
  extraDelayMs: number;
  reader?: MediaMTXWebRTCReader | null;
}

export function BoxOverlay({
  video,
  cameraId,
  settings,
  extraDelayMs,
  reader,
}: BoxOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { sets, clock } = useCameraBoxes(cameraId);
  const delayRef = useRef<VideoDelay | null>(null);

  const zones = useMemo(() => geometryOf(settings), [settings]);

  useEffect(() => {
    // reader.peerConnection is read from the reader instance
    const vd = new VideoDelay(() => reader?.peerConnection ?? null);
    delayRef.current = vd;
    vd.start();
    return () => {
      vd.stop();
      delayRef.current = null;
    };
  }, [reader]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;

    let running = true;
    let animId: number | null = null;

    const anyVideo = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (id: number) => void;
    };

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = video.clientWidth;
      const ch = video.clientHeight;

      if (!vw || !vh || !cw || !ch) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      // Compute object-fit: contain dimensions
      const videoRatio = vw / vh;
      const containerRatio = cw / ch;

      let displayW = cw;
      let displayH = ch;
      let left = 0;
      let top = 0;

      if (containerRatio > videoRatio) {
        displayH = ch;
        displayW = ch * videoRatio;
        left = (cw - displayW) / 2;
      } else {
        displayW = cw;
        displayH = cw / videoRatio;
        top = (ch - displayH) / 2;
      }

      const intW = Math.round(displayW);
      const intH = Math.round(displayH);
      const intLeft = Math.round(left);
      const intTop = Math.round(top);

      canvas.style.left = `${intLeft}px`;
      canvas.style.top = `${intTop}px`;
      canvas.style.width = `${intW}px`;
      canvas.style.height = `${intH}px`;

      if (canvas.width !== intW || canvas.height !== intH) {
        canvas.width = intW;
        canvas.height = intH;
      }

      ctx.clearRect(0, 0, intW, intH);

      // Draw zones
      // Polygons
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeStyle = '#3b82f6';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';

      for (const poly of zones.polygons) {
        if (poly.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(poly[0][0] * intW, poly[0][1] * intH);
          for (let i = 1; i < poly.length; i++) {
            ctx.lineTo(poly[i][0] * intW, poly[i][1] * intH);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }

      // Lines
      ctx.strokeStyle = '#f59e0b';
      ctx.setLineDash([4, 4]);
      for (const line of zones.lines) {
        if (line.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(line[0][0] * intW, line[0][1] * intH);
          for (let i = 1; i < line.length; i++) {
            ctx.lineTo(line[i][0] * intW, line[i][1] * intH);
          }
          ctx.stroke();
        }
      }

      // Draw boxes
      const delayMs = delayRef.current ? delayRef.current.ms() : 50;
      const targetTime = clock.serverNow() - delayMs - extraDelayMs;
      const boxes = boxesAt(sets.current, targetTime);

      ctx.setLineDash([]);
      ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace';

      for (const b of boxes) {
        const bx = b.x1 * intW;
        const by = b.y1 * intH;
        const bw = (b.x2 - b.x1) * intW;
        const bh = (b.y2 - b.y1) * intH;

        ctx.strokeStyle = '#10b981';
        ctx.strokeRect(bx, by, bw, bh);

        const labelText =
          b.trackId !== null && b.trackId !== undefined
            ? `${b.label} #${b.trackId}`
            : b.label;

        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const textHeight = 14;

        const badgeX = bx;
        const badgeY = by >= textHeight + 4 ? by - textHeight - 4 : by;

        ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
        ctx.fillRect(badgeX, badgeY, textWidth + 8, textHeight + 4);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, badgeX + 4, badgeY + textHeight - 1);
      }
    };

    const onFrame = () => {
      if (!running) return;
      render();
      if (typeof anyVideo.requestVideoFrameCallback === 'function') {
        animId = anyVideo.requestVideoFrameCallback(onFrame);
      } else {
        animId = requestAnimationFrame(onFrame);
      }
    };

    if (typeof anyVideo.requestVideoFrameCallback === 'function') {
      animId = anyVideo.requestVideoFrameCallback(onFrame);
    } else {
      animId = requestAnimationFrame(onFrame);
    }

    return () => {
      running = false;
      if (animId !== null) {
        if (typeof anyVideo.cancelVideoFrameCallback === 'function') {
          anyVideo.cancelVideoFrameCallback(animId);
        } else {
          cancelAnimationFrame(animId);
        }
      }
    };
  }, [video, zones, clock, sets, extraDelayMs]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute" />;
}

export default BoxOverlay;
