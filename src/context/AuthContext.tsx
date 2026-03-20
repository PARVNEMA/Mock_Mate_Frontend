import { createContext, useContext, useState, type ReactNode } from "react";

interface AuthContextType {
  userEmail: string | null;
  userId: string | null;
  login: (
    email: string,
    accessToken: string,
    refreshToken: string,
    userId: string,
  ) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    return localStorage.getItem("userEmail");
  });
  const [userId, setUserId] = useState<string | null>(() => {
    return localStorage.getItem("userId");
  });

  const login = (
    email: string,
    accessToken?: string,
    refreshToken?: string,
    incomingUserId?: string,
  ) => {
    setUserEmail(email);
    setUserId(incomingUserId || null);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("userId", incomingUserId || "");
    localStorage.setItem("accessToken", accessToken || "");
    localStorage.setItem("refreshToken", refreshToken || "");
  };

  const logout = () => {
    setUserEmail(null);
    setUserId(null);
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  };

  return (
    <AuthContext.Provider value={{ userEmail, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
