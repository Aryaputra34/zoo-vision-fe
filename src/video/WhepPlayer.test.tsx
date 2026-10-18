import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type ReaderConf = {
  url: string;
  onTrack?: (evt: unknown) => void;
  onError?: (err: string) => void;
};

const instances: Array<{
  conf: ReaderConf;
  closed: boolean;
  close: () => void;
}> = [];

vi.mock('./reader', () => {
  class MockMediaMTXWebRTCReader {
    conf: ReaderConf;
    closed = false;
    peerConnection = null;
    constructor(conf: ReaderConf) {
      this.conf = conf;
      instances.push(this);
    }
    close() {
      this.closed = true;
    }
  }
  return {
    MediaMTXWebRTCReader: MockMediaMTXWebRTCReader,
    default: MockMediaMTXWebRTCReader,
  };
});

import { WhepPlayer } from './WhepPlayer';

describe('WhepPlayer fallback chain', () => {
  beforeEach(() => {
    instances.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back from primary url to fallbackUrl on reader error before calling onFail', () => {
    const onFail = vi.fn();
    render(
      <WhepPlayer
        url="/media/webrtc/zv_cam/whep"
        fallbackUrl="/media/webrtc/zv_cam_sub/whep"
        onFail={onFail}
      />,
    );

    expect(instances).toHaveLength(1);
    expect(instances[0].conf.url).toBe('/media/webrtc/zv_cam/whep');

    // Simulate H.265 negotiation error on main stream
    act(() => {
      instances[0].conf.onError?.('incoming tracks are not compatible with WebRTC');
    });

    expect(instances[0].closed).toBe(true);
    expect(onFail).not.toHaveBeenCalled();
    expect(instances).toHaveLength(2);
    expect(instances[1].conf.url).toBe('/media/webrtc/zv_cam_sub/whep');

    // If sub stream also fails, onFail is called
    act(() => {
      instances[1].conf.onError?.('stream not found');
    });

    expect(instances[1].closed).toBe(true);
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it('falls back to fallbackUrl after 10s without a frame and stays playing when fallback succeeds', () => {
    const onFail = vi.fn();
    const { container } = render(
      <WhepPlayer
        url="/media/webrtc/zv_cam/whep"
        fallbackUrl="/media/webrtc/zv_cam_sub/whep"
        onFail={onFail}
      />,
    );

    expect(instances).toHaveLength(1);
    expect(instances[0].conf.url).toBe('/media/webrtc/zv_cam/whep');

    // 10s passes without a playing frame on primary URL
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(instances[0].closed).toBe(true);
    expect(onFail).not.toHaveBeenCalled();
    expect(instances).toHaveLength(2);
    expect(instances[1].conf.url).toBe('/media/webrtc/zv_cam_sub/whep');

    // Fallback emits a playing frame before its 10s timer expires
    const video = container.querySelector('video')!;
    act(() => {
      video.dispatchEvent(new Event('playing'));
      vi.advanceTimersByTime(15_000);
    });

    expect(onFail).not.toHaveBeenCalled();
    expect(instances[1].closed).toBe(false);
  });

  it('does not tear down and recreate the reader when inline callbacks trigger parent re-renders', () => {
    function Wrapper() {
      const [, setReader] = React.useState<unknown>(null);
      const [, setVideo] = React.useState<HTMLVideoElement | null>(null);
      const [tick, setTick] = React.useState(0);
      return (
        <div>
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            {tick}
          </button>
          <WhepPlayer
            url="/media/webrtc/zv_cam/whep"
            playoutDelaySec={0.25}
            onVideo={(v) => setVideo(v)}
            onReader={(r) => setReader(r)}
            onFail={() => {}}
          />
        </div>
      );
    }

    const { getByRole } = render(<Wrapper />);
    expect(instances).toHaveLength(1);
    expect(instances[0].closed).toBe(false);

    // Trigger additional parent re-renders
    act(() => {
      getByRole('button').click();
      getByRole('button').click();
    });

    expect(instances).toHaveLength(1);
    expect(instances[0].closed).toBe(false);

    // Verify playoutDelaySec applies playoutDelayHint and jitterBufferTarget on track receiver
    const receiver = { playoutDelayHint: 0, jitterBufferTarget: 0 };
    act(() => {
      instances[0].conf.onTrack?.({ receiver, streams: [] });
    });
    expect(receiver.playoutDelayHint).toBe(0.25);
    expect(receiver.jitterBufferTarget).toBe(250);
  });
});
