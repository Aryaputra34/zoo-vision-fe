/**
 * Clock offset: smoothed minimum of receivedAt - sentAt over the last 50 messages.
 * serverNow = Date.now() - offset. Returns a valid number (never NaN) even if no messages yet.
 */
export class ClockSync {
  private diffs: number[] = [];
  private offset: number | null = null;

  onMessage(sentAt: number, receivedAt: number): void {
    if (typeof sentAt !== 'number' || typeof receivedAt !== 'number') return;
    const diff = receivedAt - sentAt;
    this.diffs.push(diff);
    if (this.diffs.length > 50) {
      this.diffs.shift();
    }
    const minDiff = Math.min(...this.diffs);
    if (this.offset === null) {
      this.offset = minDiff;
    } else {
      this.offset = this.offset * 0.9 + minDiff * 0.1;
    }
  }

  serverNow(): number {
    const now = Date.now();
    if (this.offset === null) {
      return now;
    }
    return now - this.offset;
  }
}

/**
 * Video delay: jitterBufferDelay / jitterBufferEmittedCount from getStats() + 50 ms network allowance,
 * averaged over 3 s, read every 500 ms.
 * ms() is the 50 ms allowance until stats exist. Returns a number (never NaN).
 */
export class VideoDelay {
  private getPc: () => RTCPeerConnection | null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private samples: number[] = [];
  private currentDelayMs = 50;
  // The stats are totals since the connection started: the delay now comes from the change between two reads
  private last: { delay: number; count: number } | null = null;

  constructor(pc: () => RTCPeerConnection | null) {
    this.getPc = pc;
  }

  start(): void {
    this.stop();
    void this.poll();
    this.timer = setInterval(() => {
      void this.poll();
    }, 500);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  ms(): number {
    return this.currentDelayMs;
  }

  private async poll(): Promise<void> {
    const pc = this.getPc();
    if (!pc || typeof pc.getStats !== 'function') return;

    try {
      const stats = await pc.getStats();
      stats.forEach((report) => {
        if (
          report.type === 'inbound-rtp' &&
          (report.kind === 'video' || report.mediaType === 'video')
        ) {
          if (
            typeof report.jitterBufferDelay === 'number' &&
            typeof report.jitterBufferEmittedCount === 'number'
          ) {
            const prev = this.last;
            this.last = { delay: report.jitterBufferDelay, count: report.jitterBufferEmittedCount };
            const frames = prev ? report.jitterBufferEmittedCount - prev.count : 0;
            if (!prev || frames <= 0) return; // first read, a reconnect (totals restart) or no new frames
            const jitterMs = ((report.jitterBufferDelay - prev.delay) / frames) * 1000;
            const sample = jitterMs + 50;
            this.samples.push(sample);
            if (this.samples.length > 6) {
              this.samples.shift();
            }
            const sum = this.samples.reduce((a, b) => a + b, 0);
            this.currentDelayMs = sum / this.samples.length;
          }
        }
      });
    } catch {
      // Keep previous delay or fallback
    }
  }
}
