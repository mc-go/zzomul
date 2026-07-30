export type AttendanceKind = 'work' | 'half' | 'off' | 'sabbatical' | 'other';

export type StatusDef = {
  code: number;
  label: string;
  kind: AttendanceKind;
  priority: number;
};

export const STATUS_MAP: Record<number, StatusDef> = {
  1: { code: 1, label: '근무', kind: 'work', priority: 10 },
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
