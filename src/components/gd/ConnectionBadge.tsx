import { Tag } from "antd";

export default function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <Tag color={connected ? "green" : "volcano"}>
      {connected ? "Connected" : "Disconnected"}
    </Tag>
  );
}
