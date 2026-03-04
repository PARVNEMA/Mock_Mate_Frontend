import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IceCandidateMessage, SignalMessage } from "../types/gd";

type PeerConnectionMap = Record<string, RTCPeerConnection>;
type StreamMap = Record<string, MediaStream>;

const defaultIceServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

const parseIceServers = (): RTCIceServer[] => {
  const raw = String(import.meta.env.VITE_GD_ICE_SERVERS || "").trim();
  if (!raw) return defaultIceServers;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as RTCIceServer[];
  } catch {
    // ignore
  }
  return defaultIceServers;
};

export function useGdWebRtc(params: {
  send: (payload: SignalMessage | IceCandidateMessage | Record<string, unknown>) => void;
}) {
  const { send } = params;
  const iceServers = useMemo(parseIceServers, []);

  const pcsRef = useRef<PeerConnectionMap>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<StreamMap>({});
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const attachLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string) => {
      if (pcsRef.current[peerId]) return pcsRef.current[peerId];

      const pc = new RTCPeerConnection({ iceServers });
      pcsRef.current[peerId] = pc;

      attachLocalTracks(pc);

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        send({
          type: "ice_candidate",
          to_user: peerId,
          candidate: event.candidate,
        });
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (!stream) return;
        setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
        }
      };

      return pc;
    },
    [attachLocalTracks, iceServers, send],
  );

  const initLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsAudioEnabled(true);
    setIsVideoEnabled(true);
    return stream;
  }, []);

  const handleRoomState = useCallback(
    async (peers: { user_id: string }[], reconnected?: boolean) => {
      if (reconnected) {
        Object.values(pcsRef.current).forEach((pc) => pc.close());
        pcsRef.current = {};
        setRemoteStreams({});
      }
      await initLocalMedia();
      peers.forEach((peer) => {
        createPeerConnection(peer.user_id);
      });
    },
    [createPeerConnection, initLocalMedia],
  );

  const handlePeerJoined = useCallback(
    async (peerId: string) => {
      await initLocalMedia();
      const pc = createPeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: "offer", to_user: peerId, sdp: offer });
    },
    [createPeerConnection, initLocalMedia, send],
  );

  const handlePeerLeft = useCallback((peerId: string) => {
    const pc = pcsRef.current[peerId];
    if (pc) pc.close();
    delete pcsRef.current[peerId];
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  const handleOffer = useCallback(
    async (fromUser: string, sdp: RTCSessionDescriptionInit) => {
      await initLocalMedia();
      const pc = createPeerConnection(fromUser);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "answer", to_user: fromUser, sdp: answer });
    },
    [createPeerConnection, initLocalMedia, send],
  );

  const handleAnswer = useCallback(async (fromUser: string, sdp: RTCSessionDescriptionInit) => {
    const pc = pcsRef.current[fromUser];
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }, []);

  const handleIceCandidate = useCallback(async (fromUser: string, candidate: RTCIceCandidateInit) => {
    const pc = pcsRef.current[fromUser];
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // ignore
    }
  }, []);

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isAudioEnabled;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setIsAudioEnabled(next);
  }, [isAudioEnabled]);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isVideoEnabled;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setIsVideoEnabled(next);
  }, [isVideoEnabled]);

  const stopAll = useCallback(() => {
    Object.values(pcsRef.current).forEach((pc) => pc.close());
    pcsRef.current = {};
    setRemoteStreams({});
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
  }, []);

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  return {
    localStream,
    remoteStreams,
    isAudioEnabled,
    isVideoEnabled,
    initLocalMedia,
    handleRoomState,
    handlePeerJoined,
    handlePeerLeft,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    toggleAudio,
    toggleVideo,
    stopAll,
  };
}
