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
    <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="relative overflow-hidden rounded-lg bg-slate-900">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="h-48 w-full object-cover"
        />
        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-200">
            Connecting...
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-2">
          <Tag color={isLocal ? "blue" : "geekblue"}>{label}</Tag>
        </div>
      </div>
    </Card>
  );
}
