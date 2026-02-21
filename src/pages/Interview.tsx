import { Typography } from "antd";
import AvatarInterviewer from "../features/interview/avatar/AvatarInterviewer";

const { Title, Paragraph } = Typography;

function Interview() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 md:mb-8">
          <Title level={2} className="mb-2!">
            AI Interview Session
          </Title>
          <Paragraph className="m-0! text-slate-500">
            Compact 2D avatar interviewer with synced speech animation.
          </Paragraph>
        </header>

        <AvatarInterviewer compact />
      </div>
    </div>
  );
}

export default Interview;
