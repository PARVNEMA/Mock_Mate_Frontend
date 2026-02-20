import { createContext, useContext, useState, type ReactNode } from "react";

interface AuthContextType {
  userEmail: string | null;
  login: (email: string, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    return localStorage.getItem("userEmail");
  });

  const login = (
    email: string,
    accessToken?: string,
    refreshToken?: string,
  ) => {
    setUserEmail(email);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("accessToken", accessToken || "");
    localStorage.setItem("refreshToken", refreshToken || "");
  };

  const logout = () => {
    setUserEmail(null);
    localStorage.removeItem("userEmail");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  };

  return (
    <AuthContext.Provider value={{ userEmail, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
