import { Card, Progress, Typography } from "antd";

const { Text } = Typography;

export default function QueueStats(props: {
  waitingCount: number;
  needed: number;
  requiredPlayers: number;
  estimatedWaitSeconds?: number | null;
}) {
  const { waitingCount, needed, requiredPlayers, estimatedWaitSeconds } = props;
  const progress = Math.min(
    100,
    Math.round((waitingCount / Math.max(1, requiredPlayers)) * 100),
  );

  return (
    <Card className="rounded-2xl border border-slate-100">
      <div className="flex items-center justify-between">
        <Text className="text-slate-500 text-xs uppercase">Queue Progress</Text>
        <Text className="text-slate-400 text-xs">
          Est. wait: {estimatedWaitSeconds ? `${estimatedWaitSeconds}s` : "—"}
        </Text>
      </div>
      <div className="mt-3">
        <Progress percent={progress} showInfo={false} />
      </div>
      <div className="mt-2 text-sm text-slate-600">
        Waiting: {waitingCount} · Needed: {needed} · Required: {requiredPlayers}
      </div>
    </Card>
  );
}
