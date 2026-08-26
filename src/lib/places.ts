import { getDb } from './db';

// 가게 좌표 저장소 — 먹기록 탭 지도에 핀을 찍기 위한 테이블.
// 가게 식별은 normalizeRestaurant(name) 결과(name_key)로 통일.
// 좌표가 없는 가게는 지도에서 그냥 생략된다 (지정은 지도 클릭으로).

export type Place = {
  nameKey: string; // normalizeRestaurant 결과
  name: string; // 표시용 원문 가게명
  lat: number;
  lng: number;
  updatedAt: string;
};

export async function ensurePlacesSchema(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS places (
      name_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export async function listPlaces(): Promise<Place[]> {
  const db = getDb();
  const res = await db.execute(`SELECT name_key, name, lat, lng, updated_at FROM places`);
  return res.rows.map((row) => ({
    nameKey: String(row.name_key),
    name: String(row.name ?? ''),
    lat: Number(row.lat),
    lng: Number(row.lng),
    updatedAt: String(row.updated_at ?? ''),
  }));
}

// 좌표 지정/수정 — 같은 가게(name_key)면 덮어씀
export async function upsertPlace(
  nameKey: string,
  name: string,
  lat: number,
  lng: number,
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO places (name_key, name, lat, lng, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(name_key) DO UPDATE SET
            name = excluded.name,
            lat = excluded.lat,
            lng = excluded.lng,
            updated_at = datetime('now')`,
    args: [nameKey, name, lat, lng],
  });
}

export async function deletePlace(nameKey: string): Promise<void> {
  const db = getDb();
  await db.execute({ sql: `DELETE FROM places WHERE name_key = ?`, args: [nameKey] });
}
