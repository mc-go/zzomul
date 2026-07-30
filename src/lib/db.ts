import { createClient, type Client } from '@libsql/client/web';

let client: Client | null = null;

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

  client = createClient({ url, authToken });
  return client;
}
