import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { getDb } from './db';

// 기념일: DB에 저장. 종류에 따라 반복 방식이 다름.
//  - birthday(생일): 매년
//  - hire(입사): 100일 단위 (100일, 200일, ...)
//  - wedding(결혼): 매년 N주년
//  - custom(기타): 매년 / 100일 단위 / 일회성 중 선택
export type AnniversaryKind = 'birthday' | 'hire' | 'wedding' | 'custom';
export type RepeatMode = 'yearly' | 'every100days' | 'once';

export type Anniversary = {
  id: number;
  ownerId: string; // 참여자 ID(사번). 팀 공용 이벤트(예: 쪼물랭)는 ''
  kind: AnniversaryKind;
  label: string; // custom/공용 이벤트 표시 이름
  date: string; // 기준일 yyyy-MM-dd
  repeat: RepeatMode;
  emoji: string;
  remindDays: number[]; // 며칠 전에 미리 알림할지 (예: [7, 1]) — 당일(0)은 항상 팝업
  createdBy: string;
  createdAt: string;
};

const KIND_EMOJI: Record<AnniversaryKind, string> = {
  birthday: '🎂',
  hire: '🌱',
  wedding: '💍',
  custom: '🎉',
};

export function emojiFor(item: Pick<Anniversary, 'kind' | 'emoji'>): string {
  return item.emoji || KIND_EMOJI[item.kind];
}

export async function ensureAnniversariesSchema(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS anniversaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'custom',
      label TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      repeat TEXT NOT NULL DEFAULT 'yearly',
      emoji TEXT NOT NULL DEFAULT '',
      remind_days TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // 쪼물랭 창립일(2025-04-25)은 기본 데이터로 1회 시드
  try {
    const res = await db.execute(`SELECT COUNT(*) AS cnt FROM anniversaries WHERE label = '쪼물랭'`);
    const cnt = Number(res.rows[0]?.cnt ?? 0);
    if (cnt === 0) {
      await db.execute({
        sql: `INSERT INTO anniversaries (owner_id, kind, label, date, repeat, emoji, remind_days)
              VALUES ('', 'custom', '쪼물랭', '2025-04-25', 'yearly', '🥨', '[7,1]')`,
        args: [],
      });
    }
  } catch {
    // 시드 실패는 치명적이지 않으므로 무시
  }
}

function parseRemindDays(raw: unknown): number[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((v): v is number => typeof v === 'number' && v > 0);
  } catch {
    return [];
  }
}

function rowToAnniversary(row: Record<string, unknown>): Anniversary {
  const kind = String(row.kind ?? 'custom');
  const repeat = String(row.repeat ?? 'yearly');
  return {
    id: Number(row.id),
    ownerId: String(row.owner_id ?? ''),
    kind: (['birthday', 'hire', 'wedding', 'custom'].includes(kind) ? kind : 'custom') as AnniversaryKind,
    label: String(row.label ?? ''),
    date: String(row.date),
    repeat: (['every100days', 'once'].includes(repeat) ? repeat : 'yearly') as RepeatMode,
    emoji: String(row.emoji ?? ''),
    remindDays: parseRemindDays(row.remind_days),
    createdBy: String(row.created_by ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

export async function listAnniversaries(): Promise<Anniversary[]> {
  const db = getDb();
  const res = await db.execute(
    `SELECT id, owner_id, kind, label, date, repeat, emoji, remind_days, created_by, created_at
     FROM anniversaries ORDER BY date ASC`,
  );
  return res.rows.map((r) => rowToAnniversary(r as Record<string, unknown>));
}

export async function createAnniversary(input: {
  ownerId: string;
  kind: AnniversaryKind;
  label: string;
  date: string;
  repeat: RepeatMode;
  emoji: string;
  remindDays: number[];
  createdBy: string;
}): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO anniversaries (owner_id, kind, label, date, repeat, emoji, remind_days, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.ownerId,
      input.kind,
      input.label,
      input.date,
      input.repeat,
      input.emoji,
      JSON.stringify(input.remindDays.filter((d) => d > 0)),
      input.createdBy,
    ],
  });
}

export async function updateAnniversary(input: {
  id: number;
  ownerId: string;
  kind: AnniversaryKind;
  label: string;
  date: string;
  repeat: RepeatMode;
  emoji: string;
  remindDays: number[];
}): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE anniversaries
          SET owner_id = ?, kind = ?, label = ?, date = ?, repeat = ?, emoji = ?, remind_days = ?
          WHERE id = ?`,
    args: [
      input.ownerId,
      input.kind,
      input.label,
      input.date,
      input.repeat,
      input.emoji,
      JSON.stringify(input.remindDays.filter((d) => d > 0)),
      input.id,
    ],
  });
}

export async function deleteAnniversary(id: number): Promise<void> {
  const db = getDb();
  await db.execute({ sql: `DELETE FROM anniversaries WHERE id = ?`, args: [id] });
}

// 'yyyy-MM-dd' → 로컬 자정 Date (new Date('yyyy-MM-dd')는 UTC 해석이라 날짜가 밀릴 수 있음)
function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// 항목이 실제로 반복되는 방식들. 입사는 100일 단위 + 매년 주년 둘 다 표시.
function repeatModes(item: Anniversary): RepeatMode[] {
  if (item.kind === 'hire') return ['every100days', 'yearly'];
  return [item.repeat];
}

// 기념일 표시 문구 (경과 일수/주년 포함)
function occurrenceText(
  item: Anniversary,
  mode: RepeatMode,
  n: number, // every100days면 경과 일수, yearly면 주년 수
  resolveName: (id: string) => string,
): string {
  const name = item.ownerId ? resolveName(item.ownerId) : '';
  switch (item.kind) {
    case 'birthday':
      return `${name} 생일`;
    case 'hire':
      return mode === 'every100days' ? `${name} 입사 ${n}일` : `${name} 입사 ${n}주년`;
    case 'wedding':
      return n > 0 ? `${name} 결혼 ${n}주년` : `${name} 결혼`;
    default: {
      const base = item.label || (name ? `${name} 기념일` : '기념일');
      if (mode === 'every100days') return `${base} ${n}일`;
      return n > 0 ? `${base} ${n}주년` : base;
    }
  }
}

export type AnniversaryOccurrence = {
  key: string;
  kind: AnniversaryKind;
  emoji: string;
  text: string;
};

// 특정 날짜에 해당하는 기념일들 (캘린더 셀 배지용)
export function occurrencesOnDate(
  items: Anniversary[],
  day: Date,
  resolveName: (id: string) => string,
): AnniversaryOccurrence[] {
  const out: AnniversaryOccurrence[] = [];
  for (const item of items) {
    const base = parseLocalDate(item.date);
    if (!base) continue;
    for (const mode of repeatModes(item)) {
      if (mode === 'once') {
        // 일회성: 기준일 당일에만 표시
        if (differenceInCalendarDays(day, base) === 0) {
          out.push({
            key: `${item.id}-once`,
            kind: item.kind,
            emoji: emojiFor(item),
            text: occurrenceText(item, mode, 0, resolveName),
          });
        }
      } else if (mode === 'every100days') {
        const diff = differenceInCalendarDays(day, base);
        if (diff > 0 && diff % 100 === 0) {
          out.push({
            key: `${item.id}-${diff}`,
            kind: item.kind,
            emoji: emojiFor(item),
            text: occurrenceText(item, mode, diff, resolveName),
          });
        }
      } else {
        const years = day.getFullYear() - base.getFullYear();
        // 입사 주년은 1주년부터 (입사 당일은 주년이 아님)
        const minYears = item.kind === 'hire' ? 1 : 0;
        if (years >= minYears && format(day, 'MM-dd') === format(base, 'MM-dd')) {
          out.push({
            key: `${item.id}-y${years}`,
            kind: item.kind,
            emoji: emojiFor(item),
            text: occurrenceText(item, mode, years, resolveName),
          });
        }
      }
    }
  }
  return out;
}

export type AnniversaryNotice = {
  key: string; // 알림 중복 방지용 (localStorage seen 키)
  kind: AnniversaryKind;
  emoji: string;
  text: string;
  daysUntil: number; // 0이면 당일
  date: string; // 기념일 당일 yyyy-MM-dd
};

// 오늘 기준으로 띄워야 할 알림 목록.
// 당일(D-0)은 알림 설정과 무관하게 항상 포함, 나머지는 remindDays에 맞을 때만.
export function noticesForToday(
  items: Anniversary[],
  today: Date,
  resolveName: (id: string) => string,
): AnniversaryNotice[] {
  const out: AnniversaryNotice[] = [];
  for (const item of items) {
    const base = parseLocalDate(item.date);
    if (!base) continue;

    for (const mode of repeatModes(item)) {
      let occ: Date | null = null;
      let n = 0;
      if (mode === 'once') {
        // 일회성: 기준일이 지났으면 더 이상 알림 없음
        if (differenceInCalendarDays(base, today) < 0) continue;
        occ = base;
      } else if (mode === 'every100days') {
        const diff = differenceInCalendarDays(today, base);
        // 다음(혹은 오늘) 100일 단위 시점
        const nextN = diff <= 0 ? 100 : diff % 100 === 0 ? diff : (Math.floor(diff / 100) + 1) * 100;
        occ = addDays(base, nextN);
        n = nextN;
      } else {
        // 올해 기념일이 이미 지났으면 내년
        let year = today.getFullYear();
        let candidate = new Date(year, base.getMonth(), base.getDate());
        if (differenceInCalendarDays(candidate, today) < 0) {
          year += 1;
          candidate = new Date(year, base.getMonth(), base.getDate());
        }
        occ = candidate;
        n = year - base.getFullYear();
        if (n < 0) continue; // 기준일이 미래면 아직 표시할 것 없음
        if (item.kind === 'hire' && n === 0) continue; // 입사 당일은 주년 아님
      }

      const daysUntil = differenceInCalendarDays(occ, today);
      if (daysUntil < 0) continue;
      // 당일은 무조건, 그 외엔 설정된 며칠 전에만
      if (daysUntil !== 0 && !item.remindDays.includes(daysUntil)) continue;

      out.push({
        key: `anniv-${item.id}-${mode}-${format(occ, 'yyyy-MM-dd')}-d${daysUntil}`,
        kind: item.kind,
        emoji: emojiFor(item),
        text: occurrenceText(item, mode, n, resolveName),
        daysUntil,
        date: format(occ, 'yyyy-MM-dd'),
      });
    }
  }
  // 당일 먼저, 그다음 임박한 순
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}
