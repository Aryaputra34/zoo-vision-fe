import { useEffect, useRef, useState } from 'react';
import type { BoxesMessage } from '@/contract/web';
import { type BoxSet, prune } from '@/video/boxes-at';
import { ClockSync } from '@/video/sync';
import { useLiveContext } from './LiveProvider';

/**
 * Joins camera:<id> on the live socket when connected and on every connect,
 * leaves on unmount or id change, buffers and prunes boxes messages for the camera.
 */
export function useCameraBoxes(cameraId: string | null): {
  sets: React.MutableRefObject<BoxSet[]>;
  clock: ClockSync;
} {
  const { socket } = useLiveContext();
  const sets = useRef<BoxSet[]>([]);
  const [clock] = useState(() => new ClockSync());

  useEffect(() => {
    sets.current = [];
    if (!socket || !cameraId) {
      return;
    }

    const room = `camera:${cameraId}`;

    const join = () => {
      if (socket.connected) {
        socket.emit('subscribe', { rooms: [room] }, (ack) => {
          if (!ack.ok) {
            console.error(`Failed to subscribe to ${room}: ${ack.code}`);
          }
        });
      }
    };

    const handleBoxes = (msg: BoxesMessage) => {
      if (msg.cameraId !== cameraId) return;
      clock.onMessage(msg.sentAt, Date.now());
      sets.current.push({ t: msg.t, boxes: msg.boxes });
      sets.current.sort((a, b) => a.t - b.t);
      sets.current = prune(sets.current, msg.t, 2000);
    };

    join();
    socket.on('connect', join);
    socket.on('boxes', handleBoxes);

    return () => {
      socket.off('connect', join);
      socket.off('boxes', handleBoxes);
      if (socket.connected) {
        socket.emit('unsubscribe', { rooms: [room] }, (ack) => {
          if (!ack.ok) {
            console.error(`Failed to unsubscribe from ${room}: ${ack.code}`);
          }
        });
      }
      sets.current = [];
    };
  }, [socket, cameraId, clock]);

  return { sets, clock };
}
