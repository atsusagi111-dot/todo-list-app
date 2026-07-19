// ログイン状態をアプリ全体で共有するためのContext。
// 「誰がログインしているか」「ログイン/登録/ログアウトの実行方法」をここに集約し、
// 各ページ・コンポーネントは useAuth() で参照するだけでよいようにする。
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchCurrentUser, loginAccount, logoutAccount, registerAccount } from '../authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 初回読み込み時に「ログイン状態を保持」しているか確認中かどうか
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginAccount({ email, password });
    setUser(data.user);
  }, []);

  const register = useCallback(async (email, password, confirmPassword) => {
    const data = await registerAccount({ email, password, confirmPassword });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await logoutAccount();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth は AuthProvider の内側で使用してください');
  }
  return context;
}
