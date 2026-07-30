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
