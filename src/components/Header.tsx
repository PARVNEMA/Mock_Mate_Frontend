import { Button, Dropdown, Avatar } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserOutlined, LogoutOutlined } from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

interface NavLink {
  name: string;
  href: string;
}

const links: NavLink[] = [
  { name: "Home", href: "/" },
  { name: "Quiz", href: "/quizselector" },
  { name: "Interview", href: "/interviewselector" },
  { name: "About", href: "/about" },
];

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { userEmail, logout } = useAuth();

  const handleLogout = async () => {
    console.log("[Header] Initiating logout...");
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/auth/logout`,
        {},
        {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        },
      );
      console.log("[Header] ✅ Logout successful:", data.message);
      logout();
      navigate("/");
    } catch (error: any) {
      console.error("[Header] ❌ Logout failed:", error.response?.data || error.message);
    }
  };

  const profileMenu = {
    items: [
      {
        key: "email",
        label: <span className="text-gray-700 font-medium">{userEmail}</span>,
        disabled: true,
      },
      {
        type: "divider" as const,
      },
      {
        key: "logout",
        label: "Sign Out",
        icon: <LogoutOutlined />,
        danger: true,
        onClick: handleLogout,
      },
    ],
  };

  return (
    <nav className="w-full bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo Section */}
          <div className="shrink-0 flex items-center">
            <span className="text-xl font-bold text-blue-600">MockMate</span>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex space-x-8 items-center">
            {links.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-gray-700 hover:text-blue-600 transition"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Auth Section */}
          <div className="hidden md:flex items-center space-x-4">
            {userEmail ? (
              <Dropdown
                menu={profileMenu}
                trigger={["hover", "click"]}
                placement="bottomRight"
              >
                <div className="flex items-center gap-2 cursor-pointer group">
                  <Avatar
                    icon={<UserOutlined />}
                    className="bg-blue-600 group-hover:bg-blue-700 transition-colors cursor-pointer"
                    size={38}
                  />
                </div>
              </Dropdown>
            ) : (
              <>
                <Button onClick={() => navigate("/signin")}>SignIn</Button>
                <Button type="primary" onClick={() => navigate("/signup")}>
                  SignUp
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 focus:outline-none"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden px-4 pb-4 space-y-2">
          {links.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="block text-gray-700 hover:text-blue-600 transition"
            >
              {link.name}
            </a>
          ))}
          <hr />
          {userEmail ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 px-1">{userEmail}</p>
              <Button danger onClick={handleLogout} block>
                Sign Out
              </Button>
            </div>
          ) : (
            <>
              <Button onClick={() => navigate("/signin")}>SignIn</Button>
              <Button type="primary" onClick={() => navigate("/signup")}>
                SignUp
              </Button>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Header;
