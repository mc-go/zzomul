export const MEMBER_EMPNOS = ['2023124', '2023020', '2024019'] as const;

export type MemberEmpNo = (typeof MEMBER_EMPNOS)[number];

export function isTrackedMember(empNo: string | null | undefined): empNo is MemberEmpNo {
  return !!empNo && (MEMBER_EMPNOS as readonly string[]).includes(empNo);
}

// 듀얼아이 로그인은 이메일 기반, 근태 API는 사번 기반. 사이를 이어줄 매핑.
// 새 멤버 추가 시 여기에 한 줄 추가.
const EMAIL_TO_EMPNO_RAW: Record<string, MemberEmpNo> = {
  'mc.go14@konai.com': '2023124',
  // '동료1@konai.com': '2023020',
  // '동료2@konai.com': '2024019',
};

const EMAIL_TO_EMPNO: Record<string, MemberEmpNo> = Object.fromEntries(
  Object.entries(EMAIL_TO_EMPNO_RAW).map(([k, v]) => [k.toLowerCase(), v]),
);

export function empNoForLogin(username: string | null | undefined): MemberEmpNo | null {
  if (!username) return null;
  return EMAIL_TO_EMPNO[username.toLowerCase()] ?? null;
}

// 캘린더에는 안 나오지만 먹기록의 참여자 리스트엔 들어가는 사람들 (예: 퇴사자).
export const EXTRA_PARTICIPANTS = [{ id: 'ex_sohyun', name: '박소현' }] as const;

export type ExtraParticipantId = (typeof EXTRA_PARTICIPANTS)[number]['id'];
export type ParticipantId = MemberEmpNo | ExtraParticipantId;

const EXTRA_NAME_MAP: Record<string, string> = Object.fromEntries(
  EXTRA_PARTICIPANTS.map((e) => [e.id, e.name]),
);

export const ALL_PARTICIPANT_IDS: readonly ParticipantId[] = [
  ...MEMBER_EMPNOS,
  ...EXTRA_PARTICIPANTS.map((e) => e.id as ExtraParticipantId),
];

export function extraParticipantName(id: string): string | null {
  return EXTRA_NAME_MAP[id] ?? null;
}

export function isValidParticipantId(id: string): id is ParticipantId {
  return (MEMBER_EMPNOS as readonly string[]).includes(id) || id in EXTRA_NAME_MAP;
}
