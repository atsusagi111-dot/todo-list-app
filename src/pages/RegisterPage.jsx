import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// 英数字6文字以上かどうかを画面側でも即時チェックする（最終的な検証はサーバー側でも行う）
const PASSWORD_REGEX = /^[A-Za-z0-9]{6,}$/;

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  // 招待メール内のリンク（/register?email=...）から開いた場合、招待先のメールアドレスを自動入力する
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('メールアドレスを入力してください');
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      setErrorMessage('パスワードは6文字以上の英数字で入力してください');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('パスワードと確認用パスワードが一致しません');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, confirmPassword);
      navigate('/', { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-16">
        <header className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30">
            <UserPlus className="h-7 w-7 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            新規登録
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            必要な情報を入力してアカウントを作成してください
          </p>
        </header>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-error-100 bg-error-50 px-4 py-3 text-sm font-medium text-error-600">
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@email.com"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              パスワード <span className="font-normal text-slate-400">（6文字以上の英数字）</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="6文字以上の英数字"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              パスワード（確認用）
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="もう一度入力してください"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '登録中...' : '登録する'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          既にアカウントをお持ちの方は{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
