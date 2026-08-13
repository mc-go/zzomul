import { parseKoreanTimeToMinutes, type AttendanceRecord } from './attendance';

export type AttendanceKind = 'work' | 'half' | 'off' | 'sabbatical' | 'other';

export type StatusDef = {
  code: number;
  label: string;
  kind: AttendanceKind;
  priority: number;
};

export const STATUS_MAP: Record<number, StatusDef> = {
  1: { code: 1, label: '근무', kind: 'work', priority: 10 },
  2: { code: 2, label: '근무', kind: 'work', priority: 10 },
  70005: { code: 70005, label: '반차', kind: 'half', priority: 40 },
  70006: { code: 70006, label: '휴가', kind: 'off', priority: 60 },
  70012: { code: 70012, label: '안식휴가', kind: 'sabbatical', priority: 70 },
};

const OTHER: StatusDef = { code: 0, label: '기타', kind: 'other', priority: 0 };

export function pickStatus(codes: number[] | null | undefined): StatusDef {
  if (!codes || codes.length === 0) return OTHER;
  const known = codes.map((c) => STATUS_MAP[c]).filter((s): s is StatusDef => !!s);
  if (known.length === 0) return OTHER;
  return known.reduce((a, b) => (b.priority > a.priority ? b : a));
}

export function kindFor(codes: number[] | null | undefined): AttendanceKind {
  return pickStatus(codes).kind;
}

export function labelFor(codes: number[] | null | undefined): string {
  return pickStatus(codes).label;
}

// 반차면 출근(없으면 근무 예정) 시작 시각으로 오전/오후를 구분한 라벨을 돌려준다.
// 시각을 못 읽으면 그냥 "반차". 반차가 아니면 기본 라벨 그대로.
export function labelForRecord(record: AttendanceRecord): string {
  const status = pickStatus(record.attendanceStatus);
  if (status.kind !== 'half') return status.label;
  const start =
    parseKoreanTimeToMinutes(record.workTime) ?? parseKoreanTimeToMinutes(record.scheduleTime);
  if (start == null) return status.label;
  return start >= 12 * 60 ? '오전 반차' : '오후 반차';
}

// 점심시간에 회사에 없는 날인지 — 연차(휴가)·안식휴가는 종일 부재, 반차는 오전 반차만 해당.
// 반차 코드(70005)는 오전/오후 구분이 없어서 출근(없으면 근무 예정) 시작 시각으로 판별:
//   오전 반차 = 8:30~13:30 휴무 → 13:30경 출근(정오 이후) → 점심 부재
//   오후 반차 = 13:30~17:30 휴무 → 8:30 출근(정오 이전) → 점심은 회사에서
// 경계를 13:30이 아닌 정오로 둔 이유: 오전 반차인 사람이 13:30보다 일찍 찍어도 안전하게 잡기 위함.
// 도시락 리포트 집계와 날짜 상세의 점심 라벨(도시락/약속) 노출 판정에 공용으로 사용.
export function isAwayAtLunch(record: AttendanceRecord | null | undefined): boolean {
  if (!record) return false;
  const kind = kindFor(record.attendanceStatus);
  if (kind === 'off' || kind === 'sabbatical') return true;
  if (kind === 'half') {
    const start =
      parseKoreanTimeToMinutes(record.workTime) ?? parseKoreanTimeToMinutes(record.scheduleTime);
    return start != null && start >= 12 * 60;
  }
  return false;
}

export const KIND_STYLES: Record<AttendanceKind, string> = {
  work: 'bg-ink-100 text-ink-700 border-ink-100',
  half: 'bg-amber-50 text-amber-700 border-amber-100',
  off: 'bg-accent-soft text-accent border-accent/20',
  sabbatical: 'bg-violet-50 text-violet-700 border-violet-100',
  other: 'bg-ink-50 text-ink-400 border-ink-100',
};

export const DOT_STYLES: Record<AttendanceKind, string> = {
  work: 'bg-ink-300',
  half: 'bg-amber-400',
  off: 'bg-accent',
  sabbatical: 'bg-violet-500',
  other: 'bg-ink-200',
};

export type LegendItem = { kind: AttendanceKind; label: string; alwaysShow: boolean };

export const LEGEND_ITEMS: LegendItem[] = [
  { kind: 'work', label: '근무', alwaysShow: true },
  { kind: 'half', label: '반차', alwaysShow: true },
  { kind: 'off', label: '휴가', alwaysShow: true },
  { kind: 'sabbatical', label: '안식휴가', alwaysShow: false },
];
