import { verifyLocalUser } from './local-users';

const API_BASE = 'https://atdapi.duallmaster.com';
const STORAGE_KEY = 'zzomul.session.v1';

export type Role = 'konai' | 'guest';

export type Session = {
  token: string;              // 듀얼아이 JWT (guest는 빈 문자열)
  role: Role;
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
    if (!parsed?.username) return null;
    // 이전 버전 호환: role 없으면 konai로 간주
    if (!parsed.role) parsed.role = 'konai';
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

export async function loginDuall(username: string, password: string): Promise<Session> {
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
  console.log('[login response keys]', Object.keys(data));

  const token = typeof data.authToken === 'string' ? data.authToken : null;
  if (!token) {
    throw new Error('응답에 authToken이 없어요.');
  }

  const asString = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : undefined);

  const session: Session = {
    token,
    role: 'konai',
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

export async function loginGuest(username: string, password: string): Promise<Session> {
  const user = await verifyLocalUser(username, password);
  if (!user) throw new Error('아이디 또는 비밀번호가 올바르지 않아요.');

  const session: Session = {
    token: '',
    role: user.role,
    username: user.username,
    userId: user.username,
    empNo: user.participantId || undefined,
    empNm: user.displayName || undefined,
    savedAt: Date.now(),
  };
  writeSession(session);
  return session;
}

// 이전 코드가 login()을 임포트하는 경우를 위해 alias 유지
export const login = loginDuall;

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
