import { StrictMode } from "react";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { createRoot } from "react-dom/client";
import Home from "./pages/Home";
import SignIn from "./pages/SignIn.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
    children: [
      {
        path: "/about",
        element: <h1>About</h1>,
      },
    ],
  },
  {
    path: "/signin",
    element: <SignIn />,
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
