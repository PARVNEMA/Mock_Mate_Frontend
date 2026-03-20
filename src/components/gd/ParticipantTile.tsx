import { useEffect, useRef } from "react";
import { Card, Tag } from "antd";

type Props = {
  stream: MediaStream | null;
  label: string;
  isLocal?: boolean;
};

export default function ParticipantTile({ stream, label, isLocal }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <Card className="rounded-xl overflow-hidden border border-slate-100">
      <div className="relative bg-slate-900 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-48 object-cover"
        />
        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-200 text-sm">
            Connecting…
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-2">
          <Tag color={isLocal ? "blue" : "geekblue"}>{label}</Tag>
        </div>
      </div>
    </Card>
  );
}
