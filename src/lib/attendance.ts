import { apiGet } from './auth';
import { MEMBER_EMPNOS, type MemberEmpNo } from './members';

export type AttendanceRecord = {
  id: number;
  empNo: string;
  empNm: string;
  date: string;
  dateValue: string;
  workTime: string;
  scheduleTime: string;
  orgNm: string;
  posNm: string;
  attendanceStatus: number[];
};

export async function fetchAttendances(
  token: string,
  startDate: string,
  endDate: string,
): Promise<AttendanceRecord[]> {
  const url = `/attendance/attendances?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  const all = await apiGet<AttendanceRecord[]>(url, token);
  return all.filter((row) => (MEMBER_EMPNOS as readonly string[]).includes(row.empNo));
}

export type MemberDaily = Record<MemberEmpNo, Record<string, AttendanceRecord | undefined>>;

export function indexByMemberAndDate(records: AttendanceRecord[]): MemberDaily {
  const acc: MemberDaily = {
    '2023124': {},
    '2023020': {},
    '2024019': {},
  };
  for (const row of records) {
    const key = row.empNo as MemberEmpNo;
    if (!acc[key]) continue;
    acc[key][row.dateValue] = row;
  }
  return acc;
}

export function collectNames(records: AttendanceRecord[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of records) {
    if (!map[row.empNo] && row.empNm) map[row.empNo] = row.empNm;
  }
  return map;
}

export type EmployeeRecord = {
  empId: number;
  empNo: string;
  empNm: string;
  orgNm: string;
  posNm: string;
};

export async function fetchEmployees(token: string): Promise<EmployeeRecord[]> {
  return apiGet<EmployeeRecord[]>('/attendance/employees', token);
}

// "오전 8:30" / "오후 5:30" 같은 한국어 시각을 자정 기준 분(minute)으로 변환.
// 파싱 실패 시 null.
export function parseKoreanTimeToMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(오전|오후)\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const meridiem = m[1];
  let h = Number(m[2]);
  const min = Number(m[3]);
  if (isNaN(h) || isNaN(min)) return null;
  if (meridiem === '오후' && h !== 12) h += 12;
  if (meridiem === '오전' && h === 12) h = 0;
  return h * 60 + min;
}

// workTime 시작이 scheduleTime 시작보다 늦으면 지각.
// 둘 중 하나라도 파싱 실패면 false (판단 불가).
export function isLateArrival(workTime: string, scheduleTime: string): boolean {
  const actual = parseKoreanTimeToMinutes(workTime);
  const scheduled = parseKoreanTimeToMinutes(scheduleTime);
  if (actual == null || scheduled == null) return false;
  return actual > scheduled;
}

export async function fetchTrackedNames(token: string): Promise<Record<string, string>> {
  const all = await fetchEmployees(token);
  const map: Record<string, string> = {};
  for (const emp of all) {
    if ((MEMBER_EMPNOS as readonly string[]).includes(emp.empNo)) {
      map[emp.empNo] = emp.empNm;
    }
  }
  return map;
}
