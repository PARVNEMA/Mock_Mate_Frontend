import { Card, Typography, Tag } from "antd";

type TranscriptItem = {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
};

type Props = {
  items: TranscriptItem[];
};

const { Title, Text } = Typography;

export default function TranscriptPanel({ items }: Props) {
  return (
    <Card className="rounded-2xl border border-slate-100">
      <Title level={4} className="m-0!">
        Live Transcript
      </Title>
      <div className="mt-3 max-h-64 overflow-y-auto space-y-3">
        {items.length === 0 && (
          <Text className="text-slate-500">No transcript yet.</Text>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex gap-2">
            <Tag color="geekblue">{item.userId}</Tag>
            <div className="flex-1">
              <div className="text-slate-800">{item.text}</div>
              <div className="text-xs text-slate-400">
                {new Date(item.timestamp * 1000).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
