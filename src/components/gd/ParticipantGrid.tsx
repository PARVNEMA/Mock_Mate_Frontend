import { useMemo } from "react";
import ParticipantTile from "./ParticipantTile";

type Props = {
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  remotePeerIds: string[];
  localLabel?: string;
  mutedParticipantIds?: string[];
  isLocalMuted?: boolean;
};

export default function ParticipantGrid({
  localStream,
  remoteStreams,
  remotePeerIds,
  localLabel = "You",
  mutedParticipantIds = [],
  isLocalMuted = false,
}: Props) {
  const uniquePeerIds = useMemo(
    () => [...new Set(remotePeerIds.filter(Boolean))],
    [remotePeerIds],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <ParticipantTile stream={localStream} label={localLabel} isLocal isMuted={isLocalMuted} />
      {uniquePeerIds.map((peerId) => (
        <ParticipantTile
          key={peerId}
          stream={remoteStreams[peerId] || null}
          label={peerId}
          isMuted={mutedParticipantIds.includes(peerId)}
        />
      ))}
    </div>
  );
}
