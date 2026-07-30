const API_BASE = 'https://atdapi.duallmaster.com';
const STORAGE_KEY = 'zzomul.session.v1';

export type Session = {
  token: string;
  username: string;
  empNo?: string;
  empNm?: string;
  userId?: string | number;
  accountId?: string | number;
  savedAt: number;
};

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function login(username: string, password: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, enableRemoveOldSession: true }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `로그인 실패 (${res.status})`);
  }

  const data = (await res.json()) as Record<string, unknown>;

  // 진단용 로그: 로그인 응답에 어떤 필드가 오는지 콘솔에서 확인 가능
  console.log('[login response keys]', Object.keys(data));

  const token = typeof data.authToken === 'string' ? data.authToken : null;
  if (!token) {
    throw new Error('응답에 authToken이 없어요.');
  }

  const asString = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : undefined);

  const session: Session = {
    token,
    username: asString(data.username) ?? username,
    empNo: asString(data.empNo),
    empNm: asString(data.empNm),
    userId: (asString(data.userId) as string | undefined) as string | number | undefined,
    accountId: (asString(data.accountId) as string | undefined) as string | number | undefined,
    savedAt: Date.now(),
  };
  writeSession(session);
  return session;
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    clearSession();
    throw new Error('세션이 만료됐어요. 다시 로그인해 주세요.');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `요청 실패 (${res.status})`);
  }

  return res.json() as Promise<T>;
}
