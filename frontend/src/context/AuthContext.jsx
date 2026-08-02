import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('auth');
    return saved ? JSON.parse(saved) : { token: '', user: null };
  });

  const value = useMemo(
    () => ({
      auth,
      login(payload) {
        setAuth(payload);
        localStorage.setItem('auth', JSON.stringify(payload));
      },
      logout() {
        setAuth({ token: '', user: null });
        localStorage.removeItem('auth');
      }
    }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
