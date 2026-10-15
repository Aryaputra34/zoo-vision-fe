import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/contract/web';

export type LiveSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Same origin through Caddy: the session cookie goes with the handshake. LiveProvider decides when to connect.
export function createSocket(): LiveSocket {
  return io({ path: '/ws', transports: ['websocket'], autoConnect: false });
}
