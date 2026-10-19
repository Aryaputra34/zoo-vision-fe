export interface MediaMTXWebRTCReaderOptions {
  url: string;
  user?: string;
  pass?: string;
  token?: string;
  onError?: (err: string) => void;
  onTrack?: (evt: RTCTrackEvent) => void;
  onDataChannel?: (evt: RTCDataChannelEvent) => void;
}

export class MediaMTXWebRTCReader {
  constructor(conf: MediaMTXWebRTCReaderOptions);
  close(): void;
  get peerConnection(): RTCPeerConnection | null;
}

export default MediaMTXWebRTCReader;
