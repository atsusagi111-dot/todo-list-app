import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Todo画面の上部に表示する、ログイン中メールアドレス＋ログアウトボタンの小さなバー。
// 既存のTodo画面のデザイン・レイアウトはそのままに、この1要素だけ追加している。
function UserBar() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-card">
      <span className="truncate text-slate-600">{user?.email}</span>
      <button
        onClick={handleLogout}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <LogOut className="h-4 w-4" strokeWidth={2.2} />
        ログアウト
      </button>
    </div>
  );
}

export default UserBar;
