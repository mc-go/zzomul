export const MEMBER_EMPNOS = ['2023124', '2023020', '2024019'] as const;

export type MemberEmpNo = (typeof MEMBER_EMPNOS)[number];

export function isTrackedMember(empNo: string | null | undefined): empNo is MemberEmpNo {
  return !!empNo && (MEMBER_EMPNOS as readonly string[]).includes(empNo);
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
