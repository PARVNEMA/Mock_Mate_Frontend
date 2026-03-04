import { useMemo } from "react";
import ParticipantTile from "./ParticipantTile";

type Props = {
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  remotePeerIds: string[];
  localLabel?: string;
};

export default function ParticipantGrid({
  localStream,
  remoteStreams,
  remotePeerIds,
  localLabel = "You",
}: Props) {
  const uniquePeerIds = useMemo(
    () => [...new Set(remotePeerIds.filter(Boolean))],
    [remotePeerIds],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <ParticipantTile stream={localStream} label={localLabel} isLocal />
      {uniquePeerIds.map((peerId) => (
        <ParticipantTile key={peerId} stream={remoteStreams[peerId] || null} label={peerId} />
      ))}
    </div>
  );
}
