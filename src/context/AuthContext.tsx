import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentUser, logout as msalLogout } from '../services/authService';

interface DMSUser {
  entra_id: string;
  email: string;
  name: string;
  role: 'GlobalAdmin' | 'UserAdmin' | 'NormalUser' | 'PendingApproval';
  created_date: string;
  is_guest?: boolean;
  dashboard?: string;
}

interface AuthContextType {
  currentUser: DMSUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  logout: async () => {},
  refreshAuth: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<DMSUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = () => {
    try {
      const user = getCurrentUser();

      console.log('[AuthContext] Checking auth state:', {
        hasUser: !!user,
        userRole: user?.role,
        userEmail: user?.email
      });

      if (user) {
        console.log('[AuthContext] Authentication valid, setting user');
        setCurrentUser(user);
      } else {
        console.log('[AuthContext] Authentication invalid, clearing user');
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('[AuthContext] Auth check error:', error);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // Listen for storage events to update auth state when it changes
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'current_user') {
        console.log('[AuthContext] Storage event detected, rechecking auth state');
        checkAuth();
      }
    };

    // Listen for custom auth events
    const handleAuthEvent = () => {
      console.log('[AuthContext] Auth event detected, rechecking auth state');
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-state-changed', handleAuthEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-state-changed', handleAuthEvent);
    };
  }, []);

  const handleLogout = async () => {
    await msalLogout();
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    loading,
    logout: handleLogout,
    refreshAuth: checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};