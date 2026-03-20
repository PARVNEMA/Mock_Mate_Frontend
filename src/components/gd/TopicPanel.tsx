import { Card, Typography, Tag } from "antd";

const { Title, Text, Paragraph } = Typography;

type Props = {
  topic?: string | null;
  context?: string | null;
  keyPoints?: string[] | null;
};

export default function TopicPanel({ topic, context, keyPoints }: Props) {
  return (
    <Card className="rounded-2xl border border-slate-100">
      <Title level={4} className="m-0!">
        Topic
      </Title>
      <Paragraph className="mt-2 text-slate-700">
        {topic || "Waiting for topic..."}
      </Paragraph>
      {context && (
        <Paragraph className="text-slate-600">
          <Text strong>Context:</Text> {context}
        </Paragraph>
      )}
      {keyPoints && keyPoints.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keyPoints.map((kp) => (
            <Tag key={kp} color="blue">
              {kp}
            </Tag>
          ))}
        </div>
      )}
    </Card>
  );
}
