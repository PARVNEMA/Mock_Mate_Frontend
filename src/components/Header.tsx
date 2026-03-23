import { Button, Dropdown, Avatar, Typography } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  UserOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonFilled,
  MenuOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

const { Text } = Typography;

interface NavLink {
  name: string;
  href: string;
}

const links: NavLink[] = [
  { name: "Home", href: "/" },
  { name: "Quiz", href: "/quizselector" },
  { name: "Interview", href: "/interview" },
  { name: "GD", href: "/gd" },
  { name: "About", href: "/about" },
];

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { userEmail, logout } = useAuth();

  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const handleLogout = async () => {
    try {
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/auth/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        },
      );
      logout();
      navigate("/");
    } catch (error) {
      logout(); // Force logout on frontend even if API fails
      navigate("/");
    }
  };

  const profileMenu = {
    items: [
      {
        key: "email",
        label: (
          <div className="px-2 py-1">
            <Text className="text-[10px]! font-black! uppercase! tracking-widest! text-slate-400! block">
              Logged in as
            </Text>
            <Text className="dark:text-slate-200! font-bold!">{userEmail}</Text>
          </div>
        ),
        disabled: true,
      },
      { type: "divider" as const },
      {
        key: "profile",
        label: "My Profile",
        icon: <UserOutlined />,
        onClick: () => navigate("/profile"),
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

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  // Utility to check active link
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="w-full bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo Section */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate("/")}
          >
            <div className="w-10 h-10 bg-linear-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:rotate-6 transition-transform">
              <span className="text-white font-black text-lg">M</span>
            </div>
            <span className="text-xl font-black bg-linear-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-300 bg-clip-text text-transparent tracking-tighter">
              MockMate
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center bg-slate-100/50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
            {links.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-200 ${
                  isActive(link.href)
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Right Action Area */}
          <div className="hidden md:flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={() => setDark(!dark)}
              className="hidden w-10 h-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-amber-400 hover:border-indigo-500 transition-all shadow-sm active:scale-90"
            >
              {dark ? (
                <SunOutlined className="text-lg" />
              ) : (
                <MoonFilled className="text-lg" />
              )}
            </button>

            {/* <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" /> */}

            {userEmail ? (
              <Dropdown
                menu={profileMenu}
                trigger={["click"]}
                placement="bottomRight"
                arrow
              >
                <div className="flex items-center gap-3 cursor-pointer pl-2 group">
                  <Avatar
                    icon={<UserOutlined />}
                    className="bg-linear-to-br! from-indigo-500! to-purple-600! shadow-md group-hover:scale-105 transition-transform"
                    size={40}
                  />
                </div>
              </Dropdown>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  type="text"
                  onClick={() => navigate("/signin")}
                  className="font-bold! text-slate-600! dark:text-slate-400! hover:text-indigo-600!"
                >
                  Log In
                </Button>
                <Button
                  type="primary"
                  onClick={() => navigate("/signup")}
                  className="h-11 px-6 rounded-xl! bg-indigo-600! border-none! font-bold! shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  Sign Up
                </Button>
              </div>
            )}
          </div>

          {/* Mobile UI */}
          <div className="md:hidden flex items-center gap-3">
            <button
              onClick={() => setDark(!dark)}
              className="text-slate-500 dark:text-amber-400 text-xl"
            >
              {dark ? <SunOutlined /> : <MoonFilled />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300"
            >
              {isOpen ? <CloseOutlined /> : <MenuOutlined />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer-style Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 space-y-4 animate-in slide-in-from-top-4">
          {links.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className={`block p-4 rounded-2xl text-sm font-bold uppercase tracking-widest ${
                isActive(link.href)
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {link.name}
            </a>
          ))}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            {userEmail ? (
              <Button
                danger
                block
                size="large"
                onClick={handleLogout}
                className="rounded-xl! font-bold!"
              >
                Sign Out
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Button
                  size="large"
                  onClick={() => navigate("/signin")}
                  className="rounded-xl! font-bold! dark:bg-slate-900! dark:text-white! dark:border-slate-800!"
                >
                  Log In
                </Button>
                <Button
                  size="large"
                  type="primary"
                  onClick={() => navigate("/signup")}
                  className="rounded-xl! font-bold! bg-indigo-600! border-none!"
                >
                  Join Free
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Header;
