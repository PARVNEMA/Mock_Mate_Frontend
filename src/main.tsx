import { StrictMode } from "react";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { createRoot } from "react-dom/client";
import Home from "./pages/Home";
import SignIn from "./pages/SignIn.tsx";
import SignUp from "./pages/SignUp.tsx";
import Quiz from "./pages/Quiz.tsx";
import QuizSelector from "./components/QuizSelector.tsx";
import { Empty } from "antd";
import TTS_STT_Test from "./components/TTS_STT_Test.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import App from "./App.tsx";
import InterviewSetup from "./pages/InterviewSetup.tsx";
import InterviewRoom from "./pages/InterviewRoom.tsx";
import InterviewReport from "./pages/InterviewReport.tsx";
import GdLobby from "./pages/GdLobby.tsx";
import GdRoom from "./pages/GdRoom.tsx";
import Roadmap from "./pages/Roadmap.tsx";
import ResumeAnalysisPage from "./pages/ResumeAnalysis.tsx";
import Blog from "./pages/Blog.tsx";
import BlogPostDetail from "./pages/BlogPostDetail.tsx";
import Playlists from "./pages/Playlists.tsx";
import axios from "axios";

const backendUrl = String(import.meta.env.VITE_BACKEND_URL || "").trim();
if (backendUrl) {
  try {
    const backendHost = new URL(backendUrl).hostname.toLowerCase();
    if (backendHost.includes("ngrok")) {
      axios.defaults.headers.common["ngrok-skip-browser-warning"] = "true";
    }
  } catch {
    // Ignore invalid URL and keep default axios behavior.
  }
}

// Automatically attach Bearer token to all outgoing Axios requests
axios.interceptors.request.use((config) => {
  const rawToken = localStorage.getItem("accessToken");
  const token = String(rawToken || "").trim();
  if (token && token !== "undefined" && token !== "null") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/about",
        element: <h1>About</h1>,
      },
      {
        path: "/signin",
        element: <SignIn />,
      },
      {
        path: "/signup",
        element: <SignUp />,
      },
      {
        path: "/test",
        element: <TTS_STT_Test />,
      },
      {
        path: "/interview",
        element: <InterviewSetup />,
      },
      {
        path: "/interview/:sessionId",
        element: <InterviewRoom />,
      },
      {
        path: "/interview/:sessionId/report",
        element: <InterviewReport />,
      },
      {
        path: "/quizselector",
        element: <QuizSelector />,
        loader: async () => {
          try {
            const response = await axios.get(
              `${import.meta.env.VITE_BACKEND_URL}/quizzes/skills`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
                },
              },
            );
            return response.data;
          } catch (error) {
            console.error("Error fetching preset skills:", error);
          }
        },
      },
      {
        path: "/quiz",
        element: <Quiz />,
      },
      {
        path: "/gd",
        element: <GdLobby />,
      },
      {
        path: "/gd/room/:roomId",
        element: <GdRoom />,
      },
      {
        path: "/roadmap",
        element: <Roadmap />,
      },
      {
        path: "/resume-analysis",
        element: <ResumeAnalysisPage />,
      },
      {
        path: "/blog",
        element: <Blog />,
      },
      {
        path: "/blog/:id",
        element: <BlogPostDetail />,
      },
      {
        path: "/playlists",
        element: <Playlists />,
      },
      {
        path: "*",
        element: <Empty />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
