import { createClient, type Client, type InStatement } from '@libsql/client/web';

let client: Client | null = null;

// DB 쓰기(INSERT/UPDATE/DELETE) 성공 직후 창 전체에 알리는 이벤트.
// DailyPopup이 "서버가 알 수 있는 동작"(보고 저장, 댓글, 투표 등) 뒤에
// 오늘의 소식을 다시 확인하는 트리거로 쓴다. 조회(SELECT)는 발행 안 함.
export const DB_WRITE_EVENT = 'zzomul:db-write';

export function getDb(): Client {
  if (client) return client;
  const url = import.meta.env.VITE_TURSO_URL as string | undefined;
  const authToken = import.meta.env.VITE_TURSO_TOKEN as string | undefined;

  if (!url) {
    throw new Error('VITE_TURSO_URL 환경변수가 없어요. .env.local 확인해 주세요.');
  }
  if (!authToken) {
    throw new Error('VITE_TURSO_TOKEN 환경변수가 없어요. .env.local 확인해 주세요.');
  }

  const created = createClient({ url, authToken });
  // execute만 감싸서 쓰기 성공 후 이벤트를 발행 — 모든 lib 파일이 이 한 곳을 거친다
  const rawExecute = created.execute.bind(created);
  created.execute = (async (stmt: InStatement) => {
    const res = await rawExecute(stmt);
    try {
      const sql = typeof stmt === 'string' ? stmt : stmt.sql;
      if (/^\s*(insert|update|delete)/i.test(sql)) {
        window.dispatchEvent(new Event(DB_WRITE_EVENT));
      }
    } catch {
      // 이벤트 발행 실패는 기능에 영향 없음 — 무시
    }
    return res;
  }) as Client['execute'];
  client = created;
  return client;
}
