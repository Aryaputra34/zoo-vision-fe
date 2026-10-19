import { describe, it, expect } from 'vitest';
import { boxesAt, prune, type BoxSet } from './boxes-at';
import { ClockSync, VideoDelay } from './sync';

describe('boxesAt & video sync', () => {
  it('between two sets a tracked box glides: halfway → x1 halfway', () => {
    const setA: BoxSet = {
      t: 1000,
      boxes: [{ trackId: 1, cls: 0, label: 'horse', x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 }],
    };
    const setB: BoxSet = {
      t: 2000,
      boxes: [{ trackId: 1, cls: 0, label: 'horse', x1: 0.5, y1: 0.2, x2: 0.7, y2: 0.4 }],
    };

    const res = boxesAt([setA, setB], 1500);
    expect(res).toHaveLength(1);
    expect(res[0].trackId).toBe(1);
    expect(res[0].x1).toBeCloseTo(0.3);
    expect(res[0].x2).toBeCloseTo(0.5);
  });

  it('a track only in the earlier set is drawn as is from it when nearer, gone when the later set is nearer', () => {
    const setA: BoxSet = {
      t: 1000,
      boxes: [
        { trackId: 1, cls: 0, label: 'horse', x1: 0.1, y1: 0.1, x2: 0.2, y2: 0.2 },
        { trackId: 2, cls: 1, label: 'person', x1: 0.3, y1: 0.3, x2: 0.4, y2: 0.4 },
      ],
    };
    const setB: BoxSet = {
      t: 2000,
      boxes: [
        { trackId: 1, cls: 0, label: 'horse', x1: 0.5, y1: 0.5, x2: 0.6, y2: 0.6 },
      ],
    };

    // At t=1200, nearer is A
    const resA = boxesAt([setA, setB], 1200);
    const track2A = resA.find((b) => b.trackId === 2);
    expect(track2A).toBeDefined();
    expect(track2A?.x1).toBe(0.3);

    // At t=1800, nearer is B
    const resB = boxesAt([setA, setB], 1800);
    const track2B = resB.find((b) => b.trackId === 2);
    expect(track2B).toBeUndefined();
  });

  it('trackId null boxes come from the nearer set, never interpolated', () => {
    const setA: BoxSet = {
      t: 1000,
      boxes: [{ trackId: null, cls: 0, label: 'untracked', x1: 0.1, y1: 0.1, x2: 0.2, y2: 0.2 }],
    };
    const setB: BoxSet = {
      t: 2000,
      boxes: [{ trackId: null, cls: 0, label: 'untracked', x1: 0.9, y1: 0.9, x2: 1.0, y2: 1.0 }],
    };

    // Nearer is A
    const resA = boxesAt([setA, setB], 1400);
    expect(resA).toHaveLength(1);
    expect(resA[0].x1).toBe(0.1);

    // Nearer is B
    const resB = boxesAt([setA, setB], 1600);
    expect(resB).toHaveLength(1);
    expect(resB[0].x1).toBe(0.9);
  });

  it('t before the first set → the first set; after the last → the last; more than 2 s after the last → []', () => {
    const setA: BoxSet = {
      t: 1000,
      boxes: [{ trackId: 1, cls: 0, label: 'horse', x1: 0.1, y1: 0.1, x2: 0.2, y2: 0.2 }],
    };
    const setB: BoxSet = {
      t: 2000,
      boxes: [{ trackId: 1, cls: 0, label: 'horse', x1: 0.5, y1: 0.5, x2: 0.6, y2: 0.6 }],
    };

    // t before first set -> first set
    expect(boxesAt([setA, setB], 500)).toEqual(setA.boxes);

    // t after last set within 2s -> last set
    expect(boxesAt([setA, setB], 2500)).toEqual(setB.boxes);

    // t more than 2s after last set -> []
    expect(boxesAt([setA, setB], 4500)).toEqual([]);
  });

  it('prune keeps only sets within 2 s of the newest', () => {
    const sets: BoxSet[] = [
      { t: 1000, boxes: [] },
      { t: 1500, boxes: [] },
      { t: 2500, boxes: [] },
      { t: 3500, boxes: [] },
    ];

    const pruned = prune(sets, 3500, 2000);
    expect(pruned.map((s) => s.t)).toEqual([1500, 2500, 3500]);
  });

  it('ClockSync with no messages and VideoDelay with no stats return numbers, never NaN', () => {
    const clock = new ClockSync();
    const serverNow = clock.serverNow();
    expect(typeof serverNow).toBe('number');
    expect(Number.isNaN(serverNow)).toBe(false);

    const delay = new VideoDelay(() => null);
    const ms = delay.ms();
    expect(typeof ms).toBe('number');
    expect(Number.isNaN(ms)).toBe(false);
    expect(ms).toBe(50);
  });
});
