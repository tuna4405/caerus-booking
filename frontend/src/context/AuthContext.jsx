import { createContext, useContext, useEffect, useState } from 'react';

import {
  login as apiLogin,
  register as apiRegister,
  setToken,
  getToken,
} from '../api/client';

// client.js owns the token key ('caerus_token'). We own the user blob here.
const USER_KEY = 'caerus_user';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  // True until we've read localStorage once, so ProtectedRoute doesn't bounce a
  // logged-in user to /login on the first frame after a refresh.
  const [initializing, setInitializing] = useState(true);

  // Rehydrate the session from localStorage on mount.
  useEffect(() => {
    const storedToken = getToken();
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setTokenState(storedToken);
      } catch {
        // Corrupt user blob — drop both so we start from a clean logged-out state.
        setToken(null);
        localStorage.removeItem(USER_KEY);
      }
    }
    setInitializing(false);
  }, []);

  // Persist token (via client.js) + user, and mirror both into React state.
  function persistSession(nextToken, nextUser) {
    setToken(nextToken); // writes 'caerus_token'
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setTokenState(nextToken);
    setUser(nextUser);
  }

  // login/register let ApiError propagate so the page can show a friendly message.
  async function login(email, password) {
    const { token: nextToken, user: nextUser } = await apiLogin(email, password);
    persistSession(nextToken, nextUser);
    return nextUser;
  }

  async function register(name, email, password) {
    const { token: nextToken, user: nextUser } = await apiRegister(name, email, password);
    persistSession(nextToken, nextUser);
    return nextUser;
  }

  function logout() {
    setToken(null); // removes 'caerus_token'
    localStorage.removeItem(USER_KEY);
    setTokenState(null);
    setUser(null);
  }

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token),
    isAdmin: user?.role === 'admin',
    initializing,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
