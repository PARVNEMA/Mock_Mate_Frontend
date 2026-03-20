import { useEffect, useState } from "react";
import { Tabs, Input, Button, Typography, Tag } from "antd";
import {
  BookOutlined,
  UserOutlined,
  BulbOutlined,
  StarOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const { Title, Text } = Typography;

interface Skill {
  id: string;
  name: string;
  category: string;
}

const QuizSelector = () => {
  const [skills, setSkills] = useState<string[]>([]);
  const [presetSkills, setPresetSkills] = useState<Skill[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [customRole, setCustomRole] = useState("");
  const navigate = useNavigate();

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
  });

  const getPresetSkills = async () => {
    try {
      const response = await axios.get<Skill[]>(
        `${import.meta.env.VITE_BACKEND_URL}/quizzes/skills`,
        getAuthHeaders(),
      );
      setPresetSkills(response.data);
    } catch (error) {
      console.error("Error fetching preset skills:", error);
    }
  };

  useEffect(() => {
    getPresetSkills();
  }, []);

  const handleAddSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed) {
      setSkills((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
      setSkillInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddSkill(skillInput);
    }
  };

  // ✅ Navigate with "quick" type and empty job_description
  const skillQuiz = () => {
    navigate("/quiz", {
      state: {
        skills,
        role: "",
        type: "quick",
      },
    });
  };

  // ✅ Navigate with "job-role" type and empty skills list
  const roleQuiz = () => {
    navigate("/quiz", {
      state: {
        skills: [],
        role: customRole,
        type: "job-role",
      },
    });
  };

  const items = [
    {
      label: (
        <span className="flex items-center px-4 py-2">
          <BulbOutlined className="mr-2" /> Specific Topics
        </span>
      ),
      key: "1",
      children: (
        <div className="p-8 bg-white rounded-2xl border border-slate-100 shadow-sm min-h-75 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-amber-50 rounded-lg">
                <StarOutlined className="text-amber-500" />
              </div>
              <Title level={5} className="m-0!">
                Custom Skillset
              </Title>
            </div>

            <div className="mb-6">
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-3">
                Quick Add Popular Topics:
              </Text>
              <div className="flex flex-wrap gap-2">
                {presetSkills.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleAddSkill(preset.name)}
                    disabled={skills.includes(preset.name)}
                    className={`px-3 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1
                      ${
                        skills.includes(preset.name)
                          ? "bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed"
                          : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600"
                      }`}
                  >
                    <PlusOutlined className="text-[10px]" /> {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <Input
              placeholder="Or type a custom topic and press Enter..."
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-12 rounded-xl border-slate-200 mb-6 shadow-sm"
              prefix={<BookOutlined className="text-slate-400 mr-2" />}
            />

            <div className="flex flex-wrap gap-2 min-h-8">
              {skills.map((skill) => (
                <Tag
                  key={skill}
                  closable
                  onClose={() =>
                    setSkills((prev) => prev.filter((s) => s !== skill))
                  }
                  className="px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 border-indigo-100 text-sm font-medium"
                >
                  {skill}
                </Tag>
              ))}
            </div>
          </div>

          <Button
            type="primary"
            size="large"
            block
            disabled={skills.length === 0}
            className="h-12 bg-indigo-600 rounded-xl mt-8 font-semibold shadow-lg border-none"
            onClick={skillQuiz}
          >
            Generate Skill Quiz
          </Button>
        </div>
      ),
    },
    {
      label: (
        <span className="flex items-center px-4 py-2">
          <UserOutlined className="mr-2" /> Job Role
        </span>
      ),
      key: "2",
      children: (
        <div className="p-8 bg-white rounded-2xl border border-slate-100 shadow-sm min-h-75 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <UserOutlined className="text-indigo-600" />
              </div>
              <Title level={5} className="m-0!">
                Role-Based Assessment
              </Title>
            </div>
            <Text className="text-slate-500 mb-4 block">
              Specify the exact position. AI will simulate a technical round.
            </Text>
            <Input
              placeholder="e.g. Junior MERN Developer..."
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              className="h-12 rounded-xl border-slate-200 shadow-sm"
              prefix={<StarOutlined className="text-indigo-400 mr-2" />}
            />
          </div>
          <Button
            disabled={!customRole}
            type="primary"
            size="large"
            block
            onClick={roleQuiz}
            className="h-12 bg-indigo-600 rounded-xl mt-8 font-semibold shadow-lg border-none"
          >
            Start Role Interview
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto mt-16 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
          Quiz Setup
        </h1>
        <p className="text-slate-500 text-lg">
          Select your focus area and let AI handle the rest.
        </p>
      </div>
      <Tabs defaultActiveKey="1" centered items={items} />
    </div>
  );
};

export default QuizSelector;
