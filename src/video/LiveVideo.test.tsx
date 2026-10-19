import { render, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type PlayerProps = { url: string; onFail?: () => void; onPlaying?: () => void };
const players: PlayerProps[] = [];

vi.mock('./WhepPlayer', () => ({
  WhepPlayer: (props: PlayerProps) => {
    players.push(props);
    return <video data-testid="player" />;
  },
}));

import { LiveVideo } from './LiveVideo';

describe('LiveVideo', () => {
  beforeEach(() => {
    players.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('a still that failed once is retried on the next tick and shows again when it loads', () => {
    const { container, getByText } = render(
      <LiveVideo cameraId="cam_a" alt="still" url={null} emptyText="Kamera Offline" />,
    );
    const img = container.querySelector('img')!;
    const firstSrc = img.getAttribute('src');
    fireEvent.error(img);
    expect(getByText('Kamera Offline')).toBeTruthy();

    act(() => vi.advanceTimersByTime(2000));
    const same = container.querySelector('img')!;
    expect(same).toBe(img); // still mounted
    expect(same.getAttribute('src')).not.toBe(firstSrc);
    fireEvent.load(same);
    expect(same.className).not.toContain('hidden');
  });

  it('a failed player shows the still, then a new player tries again 5 s later', () => {
    const { container, queryByTestId } = render(
      <LiveVideo cameraId="cam_a" alt="still" url="/media/webrtc/zv_cam_a/whep" emptyText="x" />,
    );
    expect(players.length).toBeGreaterThan(0);
    act(() => players[players.length - 1].onFail?.());
    expect(queryByTestId('player')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();

    const before = players.length;
    act(() => vi.advanceTimersByTime(5000));
    expect(queryByTestId('player')).not.toBeNull();
    expect(players.length).toBeGreaterThan(before);

    act(() => players[players.length - 1].onPlaying?.());
    expect(container.querySelector('img')).toBeNull(); // playing: the still is gone
  });
});
