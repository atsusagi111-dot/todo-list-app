import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await login(email, password);
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
            <LogIn className="h-7 w-7 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            ログイン
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            メールアドレスとパスワードでログインしてください
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
              パスワード
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          アカウントをお持ちでない方は{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
            新規登録
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
