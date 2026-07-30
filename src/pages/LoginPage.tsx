import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LuLogIn } from 'react-icons/lu';
import { GiPretzel } from 'react-icons/gi';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { session, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/calendar';
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <GiPretzel className="text-4xl text-pretzel drop-shadow-sm animate-wiggle hover:animate-float" />
            <h1 className="text-2xl font-semibold tracking-tight">쪼물랭</h1>
          </div>
          <p className="mt-1 text-sm text-ink-400">듀얼아이 계정으로 로그인해 주세요.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-ink-500 mb-1.5">
              이메일
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-md border border-ink-200 bg-white text-sm placeholder-ink-300"
              placeholder="you@konai.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-ink-500 mb-1.5">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-md border border-ink-200 bg-white text-sm placeholder-ink-300"
            />
          </div>

          {error ? (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md bg-ink-900 text-white text-sm font-medium hover:bg-ink-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <LuLogIn className="text-base" />
            {busy ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="mt-8 text-[11px] text-ink-300 leading-relaxed">
          로그인 정보는 브라우저 로컬 스토리지에만 저장됩니다. 서버로 별도 전송하지 않아요.
        </p>
      </div>
    </div>
  );
}
