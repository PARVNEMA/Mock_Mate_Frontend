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
import { AuthProvider } from "./context/AuthContext.tsx";
import App from "./App.tsx";
import Interview from "./pages/Interview.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "*",
        element: <Empty />,
      },
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
        element: <Interview />,
      },
      {
        path: "/interview",
        element: <Interview />,
      },
      {
        path: "/quizselector",
        element: <QuizSelector />,
      },
      {
        path: "/quiz",
        element: <Quiz />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
