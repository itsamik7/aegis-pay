import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, DemoUser } from '../types';
import { api, setAuthToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  demoUsers: DemoUser[];
  isLoading: boolean;
  switchUser: (demoUser: DemoUser) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isAnalyst: boolean;
  isReviewer: boolean;
  isReadOnly: boolean;
  isMerchant: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = async () => {
    try {
      setIsLoading(true);
      // Fetch demo accounts
      const demoList = await api.getDemoUsers();
      setDemoUsers(demoList);

      // Check if existing token
      try {
        const currentUser = await api.getMe();
        setUser(currentUser);
      } catch {
        // Fallback to Risk Analyst demo user automatically
        const defaultAnalyst = demoList.find((u: DemoUser) => u.username === 'analyst') || demoList[0];
        if (defaultAnalyst) {
          setAuthToken(defaultAnalyst.token);
          setUser(defaultAnalyst);
        }
      }
    } catch (err) {
      console.error('Failed to initialize demo auth', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const switchUser = async (targetUser: DemoUser) => {
    setAuthToken(targetUser.token);
    setUser(targetUser);
  };

  const login = async (username: string, password: string) => {
    const res = await api.login({ username, password });
    setAuthToken(res.access_token);
    setUser(res.user);
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  const role = user?.role || 'Read-only Viewer';

  const value = {
    user,
    demoUsers,
    isLoading,
    switchUser,
    login,
    logout,
    isAdmin: role === 'Admin',
    isAnalyst: role === 'Admin' || role === 'Risk Analyst' || role === 'Compliance Reviewer',
    isReviewer: role === 'Admin' || role === 'Compliance Reviewer',
    isReadOnly: role === 'Read-only Viewer',
    isMerchant: role === 'Merchant',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
