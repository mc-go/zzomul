import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isWeekend,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { LuChevronLeft, LuChevronRight, LuLoader } from 'react-icons/lu';
import { FaHeart } from 'react-icons/fa';
import {
  fetchAttendances,
  indexByMemberAndDate,
  isLateArrival,
  type AttendanceRecord,
} from '../lib/attendance';
import {
  occurrencesOnDate,
  type AnniversaryKind,
  type AnniversaryOccurrence,
} from '../lib/anniversaries';
import { useAnniversaries } from '../contexts/AnniversariesContext';
import { ensureSchema as ensureLunchesSchema, listLunches, type Lunch } from '../lib/lunches';
import {
  deleteLunchPlan,
  ensureLunchPlansSchema,
  listLunchPlans,
  upsertLunchPlan,
  type LunchPlan,
} from '../lib/lunch-plans';
import { holidayName } from '../lib/holidays';
import {
  DOT_STYLES,
  KIND_STYLES,
  LEGEND_ITEMS,
  kindFor,
  labelFor,
} from '../lib/attendance-status';
import { EXTRA_PARTICIPANTS, MEMBER_EMPNOS, type MemberEmpNo } from '../lib/members';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import Avatar from '../components/Avatar';
import MemberProfileModal from '../components/MemberProfileModal';
import DatePanel from '../components/DatePanel';

const WEEKDAYS = ['월', '화', '수', '목', '금'];

// 기념일 종류별 배지 색
const ANNIV_STYLES: Record<AnniversaryKind, string> = {
  birthday: 'bg-pink-50 text-pink-600 border-pink-100',
  hire: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  wedding: 'bg-rose-50 text-rose-600 border-rose-100',
  custom: 'bg-violet-50 text-violet-600 border-violet-100',
};

export default function CalendarPage() {
  const { session, logout } = useAuth();
  const { getProfileByEmpNo, getProfile, getStatus } = useProfiles();
  const { resolveName, myEmpNo } = useAppData();
  const { items: anniversaries } = useAnniversaries();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ empNo: string; date: Date; record: AttendanceRecord | null } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarLunches, setCalendarLunches] = useState<Lunch[]>([]);
  const [lunchPlans, setLunchPlans] = useState<LunchPlan[]>([]);

  // 내 참여자 ID(사번): 프로필 저장값 우선, 없으면 자동 감지값 (LunchPage와 동일 규칙)
  const me = session?.userId ? String(session.userId) : '';
  const myPid = (me ? getProfile(me)?.empNo : '') || myEmpNo || '';

  const monthStart = useMemo(() => startOfMonth(cursor), [cursor]);
  const monthEnd = useMemo(() => endOfMonth(cursor), [cursor]);

  useEffect(() => {
    // 게스트는 듀얼아이 토큰이 없으므로 근태 조회 스킵. UI만 렌더링됨.
    if (!session?.token || session.role !== 'konai') {
      setRecords([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAttendances(session.token, format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd'))
      .then((rows) => {
        if (cancelled) return;
        setRecords(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : '조회 실패';
        setError(msg);
        if (msg.includes('세션이 만료')) logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.role, monthStart, monthEnd, logout]);

  // 먹기록을 캘린더에 함께 표시:
  //  - '가고싶은' + 예정 날짜(plannedDate) 있는 것 → 예정 스타일
  //  - '다녀옴'(done) 전부 → 그 날짜(date)에 매핑
  // (상세 패널에서 참여자 토글 후에도 재조회)
  async function refreshCalendarLunches() {
    try {
      await ensureLunchesSchema();
      const all = await listLunches();
      setCalendarLunches(
        all.filter((l) => (l.status === 'wishlist' && l.plannedDate) || l.status === 'done'),
      );
    } catch {
      /* 실패해도 캘린더 자체는 정상 렌더 */
    }
  }

  useEffect(() => {
    void refreshCalendarLunches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 개인 점심 약속 로드 (등록/삭제 후에도 재사용)
  async function refreshLunchPlans() {
    try {
      await ensureLunchPlansSchema();
      setLunchPlans(await listLunchPlans());
    } catch {
      /* 실패해도 캘린더 자체는 정상 렌더 */
    }
  }

  useEffect(() => {
    void refreshLunchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 날짜별 점심 약속
  const plansByDate = useMemo(() => {
    const map: Record<string, LunchPlan[]> = {};
    for (const p of lunchPlans) (map[p.date] ??= []).push(p);
    return map;
  }, [lunchPlans]);

  // 각 먹기록이 캘린더에 얹힐 날짜 (wishlist는 plannedDate, done은 date)
  const lunchesByDate = useMemo(() => {
    const map: Record<string, Lunch[]> = {};
    for (const l of calendarLunches) {
      const key = l.status === 'wishlist' ? l.plannedDate : l.date;
      if (!key) continue;
      (map[key] ??= []).push(l);
    }
    return map;
  }, [calendarLunches]);

  // 도시락 날: 그 날짜에 쪼물런치(점심, 예정/다녀옴)도 없고 개인 점심 약속도 없으면
  // 평소처럼 도시락을 먹는 날로 간주 (공휴일 제외). 디너 기록은 점심과 무관하므로 안 봄.
  const isDosirakDay = (dateKey: string): boolean => {
    if (holidayName(dateKey)) return false;
    const hasZzomulLunch = (lunchesByDate[dateKey] ?? []).some((l) => l.meal === 'lunch');
    const hasPlan = (plansByDate[dateKey] ?? []).length > 0;
    return !hasZzomulLunch && !hasPlan;
  };

  const byMember = useMemo(() => indexByMemberAndDate(records), [records]);
  const kindsInMonth = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) set.add(kindFor(r.attendanceStatus));
    return set;
  }, [records]);
  const today = new Date();

  const gridDays = useMemo(() => {
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d));
  }, [monthStart, monthEnd]);

  const monthDays = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }).filter((d) => !isWeekend(d)),
    [monthStart, monthEnd],
  );

  // 이번 달 도시락 리포트: 사람별 집계.
  // 판정은 상세 라벨과 동일한 우선순위 — 약속 > 쪼물런치 참여 > 도시락.
  // 이미 잡힌 쪼물런치/약속은 미래여도 포함, 도시락만 "오늘까지 지난 평일" 기준
  // (미래의 도시락은 아직 알 수 없으니까). 휴가·반차는 고려하지 않는 재미용 통계.
  const dosirakStats = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    let counted = 0; // 도시락 판정 대상이 된 지나간 평일 수
    const per: Record<string, { dosirak: number; zzomul: number; plan: number }> = {};
    for (const emp of MEMBER_EMPNOS) per[emp] = { dosirak: 0, zzomul: 0, plan: 0 };
    for (const day of monthDays) {
      const key = format(day, 'yyyy-MM-dd');
      if (holidayName(key)) continue;
      const isPast = key <= todayKey;
      if (isPast) counted += 1;
      const dayLunches = lunchesByDate[key] ?? [];
      const dayPlans = plansByDate[key] ?? [];
      for (const emp of MEMBER_EMPNOS) {
        const hasPlan = dayPlans.some((p) => p.empNo === emp);
        const inZzomulLunch = dayLunches.some(
          (l) =>
            l.meal === 'lunch' &&
            (l.participants.length === 0 || (l.participants as readonly string[]).includes(emp)),
        );
        if (hasPlan) per[emp].plan += 1;
        else if (inZzomulLunch) per[emp].zzomul += 1;
        else if (isPast) per[emp].dosirak += 1;
      }
    }
    const hasAny =
      counted > 0 || Object.values(per).some((s) => s.plan + s.zzomul > 0);
    return { counted, per, hasAny };
  }, [monthDays, lunchesByDate, plansByDate]);

  // 날짜별 기념일 배지 (그리드 범위 전체 계산)
  const annivByDate = useMemo(() => {
    const map: Record<string, AnniversaryOccurrence[]> = {};
    if (anniversaries.length === 0) return map;
    for (const day of gridDays) {
      const occ = occurrencesOnDate(anniversaries, day, resolveName);
      if (occ.length > 0) map[format(day, 'yyyy-MM-dd')] = occ;
    }
    return map;
  }, [anniversaries, gridDays, resolveName]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">
          {format(cursor, 'yyyy년 M월', { locale: ko })}
        </h1>
      </div>

      <div className="flex items-center justify-between mb-3">
        <Legend visibleKinds={kindsInMonth} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor(addMonths(cursor, -1))}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-50"
            aria-label="이전 달"
          >
            <LuChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-50"
            aria-label="다음 달"
          >
            <LuChevronRight />
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      ) : null}

      <div className="relative">
        <div
          className={`transition-opacity duration-200 ${
            loading ? 'opacity-40 pointer-events-none' : 'opacity-100'
          }`}
        >
          <section className="hidden md:block rounded-2xl border border-ink-100 bg-white shadow-card overflow-hidden">
            <div className="grid grid-cols-5 border-b border-ink-100 bg-ink-50/60">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-2 py-2 text-[11px] font-medium text-ink-500"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-5">
              {gridDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const inMonth = isSameMonth(day, cursor);
                const isToday = isSameDay(day, today);
                const holiday = holidayName(dateKey);
                return (
                  <div
                    key={dateKey}
                    className={`relative min-h-[110px] border-t border-l border-ink-100 first:border-l-0 p-2 flex flex-col gap-1.5 ${
                      inMonth ? 'bg-white' : 'bg-ink-50/40'
                    } ${isToday ? 'ring-2 ring-inset ring-pretzel' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        disabled={!inMonth}
                        onClick={() => inMonth && setSelectedDate(day)}
                        className={`text-xs font-medium rounded px-1 -mx-1 hover:bg-ink-50 disabled:cursor-default disabled:hover:bg-transparent ${
                          !inMonth
                            ? holiday
                              ? 'text-red-300'
                              : 'text-ink-300'
                            : holiday
                              ? 'text-red-500'
                              : isToday
                                ? 'text-ink-900'
                                : 'text-ink-700'
                        }`}
                      >
                        {format(day, 'd')}
                      </button>
                      {holiday && inMonth ? (
                        <span className="text-[9px] text-red-400 font-medium truncate flex-1" title={holiday}>
                          {holiday}
                        </span>
                      ) : null}
                      {isToday ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-pretzel text-white">
                          오늘
                        </span>
                      ) : null}
                    </div>
                    {annivByDate[dateKey]?.map((a) => (
                      <div
                        key={a.key}
                        className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-full border truncate ${ANNIV_STYLES[a.kind]} ${
                          inMonth ? '' : 'opacity-50'
                        }`}
                        title={a.text}
                      >
                        {a.emoji} {a.text}
                      </div>
                    ))}
                    {lunchesByDate[dateKey]?.map((l) => (
                      <div
                        key={`lunch-${l.id}`}
                        className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-full border truncate ${lunchBadgeStyle(l)} ${
                          inMonth ? '' : 'opacity-50'
                        }`}
                        title={`${l.status === 'wishlist' ? '예정' : '다녀옴'}${l.delivery ? ' · 배달' : ''} · ${l.restaurant}${l.menu ? ` (${l.menu})` : ''}`}
                      >
                        {l.delivery ? '🛵' : l.meal === 'lunch' ? '🍜' : '🌙'} {l.restaurant}
                      </div>
                    ))}
                    {plansByDate[dateKey]?.map((p) => (
                      <div
                        key={`plan-${p.empNo}`}
                        className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-full border truncate bg-teal-50 text-teal-700 border-teal-100 ${
                          inMonth ? '' : 'opacity-50'
                        }`}
                        title={`${resolveName(p.empNo)} 점심 약속${p.note ? ` · ${p.note}` : ''}`}
                      >
                        🍽️ {resolveName(p.empNo)} 약속
                      </div>
                    ))}
                    {inMonth ? (
                      <ul className="space-y-1">
                        {[
                          ...MEMBER_EMPNOS,
                          ...EXTRA_PARTICIPANTS.filter((e) => getStatus(e.id, dateKey)).map(
                            (e) => e.id,
                          ),
                        ].map((empNo) => {
                          const record = (byMember as Record<string, Record<string, AttendanceRecord | undefined> | undefined>)[empNo]?.[dateKey];
                          const kind = record ? kindFor(record.attendanceStatus) : 'other';
                          const label = record ? labelFor(record.attendanceStatus) : '';
                          const name = resolveName(empNo);
                          const profile = getProfileByEmpNo(empNo);
                          const isExtra = (EXTRA_PARTICIPANTS as readonly { id: string }[]).some(
                            (e) => e.id === empNo,
                          );
                          const hasStatus = getStatus(empNo, dateKey).length > 0;
                          const late =
                            !!record &&
                            kind === 'work' &&
                            isLateArrival(record.workTime, record.scheduleTime);
                          return (
                            <li
                              key={empNo}
                              onClick={() => setSelected({ empNo, date: day, record: record ?? null })}
                              className={`flex items-center gap-1.5 text-[11px] leading-tight pl-1 pr-1.5 py-0.5 rounded border cursor-pointer hover:brightness-95 ${
                                isExtra
                                  ? 'bg-violet-50 text-violet-700 border-violet-100'
                                  : record
                                    ? KIND_STYLES[kind]
                                    : hasStatus
                                      ? 'bg-transparent text-ink-800 border-transparent font-medium'
                                      : 'bg-transparent text-ink-300 border-transparent'
                              }`}
                              title={
                                record
                                  ? `${name} · ${label}${late ? ` (지각: ${record.workTime})` : ''}`
                                  : name
                              }
                            >
                              <Avatar profile={profile} size="xs" fallbackText={name} />
                              <span className="truncate">{name}</span>
                              <span className="ml-auto inline-flex items-center gap-1">
                                {late ? (
                                  <span className="text-[10px] font-semibold text-red-600 inline-flex items-center gap-0.5">
                                    지각
                                    <FaHeart className="text-red-500 text-[9px]" />
                                  </span>
                                ) : null}
                                {label ? <span className="text-[10px]">{label}</span> : null}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="md:hidden space-y-3">
            {monthDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const isToday = isSameDay(day, today);
              const holiday = holidayName(dateKey);
              return (
                <article
                  key={dateKey}
                  className={`rounded-2xl border bg-white p-3 shadow-card ${
                    isToday ? 'border-pretzel border-2' : 'border-ink-100'
                  }`}
                >
                  <header className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={`inline-flex items-center gap-2 text-sm font-semibold hover:opacity-70 ${
                        holiday ? 'text-red-500' : 'text-ink-900'
                      }`}
                    >
                      {format(day, 'd일 (EEE)', { locale: ko })}
                    </button>
                    {holiday ? (
                      <span className="text-[10px] text-red-400 font-medium">{holiday}</span>
                    ) : null}
                    {isToday ? (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-pretzel text-white">
                        오늘
                      </span>
                    ) : null}
                    {annivByDate[dateKey]?.map((a) => (
                      <span
                        key={a.key}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border ${ANNIV_STYLES[a.kind]}`}
                      >
                        {a.emoji} {a.text}
                      </span>
                    ))}
                    {lunchesByDate[dateKey]?.map((l) => (
                      <span
                        key={`lunch-${l.id}`}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border ${lunchBadgeStyle(l)}`}
                        title={`${l.status === 'wishlist' ? '예정' : '다녀옴'}${l.delivery ? ' · 배달' : ''} · ${l.restaurant}`}
                      >
                        {l.delivery ? '🛵' : l.meal === 'lunch' ? '🍜' : '🌙'} {l.restaurant}
                      </span>
                    ))}
                    {plansByDate[dateKey]?.map((p) => (
                      <span
                        key={`plan-${p.empNo}`}
                        className="text-[10px] px-1.5 py-0.5 rounded-full border bg-teal-50 text-teal-700 border-teal-100"
                        title={`${resolveName(p.empNo)} 점심 약속${p.note ? ` · ${p.note}` : ''}`}
                      >
                        🍽️ {resolveName(p.empNo)} 약속
                      </span>
                    ))}
                  </header>
                  <ul className="grid grid-cols-1 gap-1.5">
                    {[
                      ...MEMBER_EMPNOS,
                      ...EXTRA_PARTICIPANTS.filter((e) => getStatus(e.id, dateKey)).map(
                        (e) => e.id,
                      ),
                    ].map((empNo) => {
                      const record = (byMember as Record<string, Record<string, AttendanceRecord | undefined> | undefined>)[empNo]?.[dateKey];
                      const kind = record ? kindFor(record.attendanceStatus) : 'other';
                      const label = record ? labelFor(record.attendanceStatus) : '';
                      const name = resolveName(empNo);
                      const profile = getProfileByEmpNo(empNo);
                      const isExtra = (EXTRA_PARTICIPANTS as readonly { id: string }[]).some(
                        (e) => e.id === empNo,
                      );
                      const hasStatus = getStatus(empNo, dateKey).length > 0;
                      const late =
                        !!record &&
                        kind === 'work' &&
                        isLateArrival(record.workTime, record.scheduleTime);
                      return (
                        <li
                          key={empNo}
                          onClick={() => setSelected({ empNo, date: day, record: record ?? null })}
                          className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border cursor-pointer active:brightness-95 ${
                            isExtra
                              ? 'bg-violet-50 text-violet-700 border-violet-100'
                              : record
                                ? KIND_STYLES[kind]
                                : hasStatus
                                  ? 'bg-white text-ink-800 border-ink-100'
                                  : 'bg-ink-50/40 text-ink-300 border-ink-100'
                          }`}
                        >
                          <Avatar profile={profile} size="xs" fallbackText={name} />
                          <span className="font-medium">{name}</span>
                          <span className="ml-auto inline-flex items-center gap-1.5">
                            {late ? (
                              <span className="text-[11px] font-semibold text-red-600 inline-flex items-center gap-0.5">
                                지각
                                <FaHeart className="text-red-500 text-[10px]" />
                              </span>
                            ) : null}
                            <span>
                              {isExtra ? '게스트' : label || (hasStatus ? '메시지' : '기록 없음')}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </section>
        </div>

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="inline-flex items-center gap-2 text-xs text-ink-500 bg-white/80 backdrop-blur px-3 py-2 rounded-full border border-ink-100 shadow-card">
              <LuLoader className="animate-spin" />
              불러오는 중
            </div>
          </div>
        ) : null}
      </div>

      {/* 이번 달 도시락 리포트 — 사람별 재미 통계 (예정된 쪼물런치/약속 포함) */}
      {dosirakStats.hasAny ? (
        <section className="mt-4 rounded-2xl border border-lime-100 bg-lime-50/40 px-4 py-3">
          <h2 className="text-xs font-semibold text-ink-900 mb-2">
            🍱 {format(cursor, 'M월', { locale: ko })} 도시락 리포트
          </h2>
          <ul className="space-y-1.5">
            {MEMBER_EMPNOS.map((emp) => {
              const s = dosirakStats.per[emp];
              const name = resolveName(emp);
              return (
                <li key={emp} className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px]">
                  <Avatar profile={getProfileByEmpNo(emp)} size="xs" fallbackText={name} />
                  <span className="font-semibold text-ink-800 w-14 truncate">{name}</span>
                  <span className="px-1.5 py-0.5 rounded-full border bg-white text-lime-700 border-lime-200 font-medium">
                    🍱 {s.dosirak}일
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full border bg-white text-amber-700 border-amber-200 font-medium">
                    🍜 {s.zzomul}일
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full border bg-white text-teal-700 border-teal-200 font-medium">
                    🍽️ {s.plan}일
                  </span>
                  {s.dosirak > 0 ? (
                    <span className="sm:ml-auto font-semibold text-lime-700">
                      💰 약 {(s.dosirak * 8000).toLocaleString()}원 절약!
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] text-ink-400">
            🍜·🍽️는 예정 포함, 🍱는 오늘까지 지난 평일({dosirakStats.counted}일) 기준 · 도시락
            하루 = 외식 한 끼 8,000원 절약으로 계산했어요
          </p>
        </section>
      ) : null}

      {selected ? (
        <MemberProfileModal
          empNo={selected.empNo}
          date={selected.date}
          record={selected.record}
          onClose={() => setSelected(null)}
        />
      ) : null}

      {selectedDate ? (
        <DatePanel
          date={selectedDate}
          recordsByEmpNo={Object.fromEntries(
            MEMBER_EMPNOS.map((emp) => [
              emp,
              byMember[emp]?.[format(selectedDate, 'yyyy-MM-dd')],
            ]),
          )}
          plans={plansByDate[format(selectedDate, 'yyyy-MM-dd')] ?? []}
          lunches={lunchesByDate[format(selectedDate, 'yyyy-MM-dd')] ?? []}
          isDosirak={isDosirakDay(format(selectedDate, 'yyyy-MM-dd'))}
          myEmpNo={myPid}
          onSavePlanFor={async (empNo, note) => {
            await upsertLunchPlan(empNo, format(selectedDate, 'yyyy-MM-dd'), note);
            await refreshLunchPlans();
          }}
          onDeletePlanFor={async (empNo) => {
            await deleteLunchPlan(empNo, format(selectedDate, 'yyyy-MM-dd'));
            await refreshLunchPlans();
          }}
          onClose={() => setSelectedDate(null)}
        />
      ) : null}
    </div>
  );
}

// 먹기록 뱃지 색: 런치/디너 × 예정/다녀옴 조합
function lunchBadgeStyle(l: Lunch): string {
  const isPlanned = l.status === 'wishlist';
  if (l.meal === 'lunch') {
    return isPlanned
      ? 'bg-white text-amber-700 border-amber-300 border-dashed'
      : 'bg-amber-50 text-amber-700 border-amber-100';
  }
  return isPlanned
    ? 'bg-white text-accent border-accent/40 border-dashed'
    : 'bg-accent-soft text-accent border-accent/20';
}

function Legend({ visibleKinds }: { visibleKinds: Set<string> }) {
  const items = LEGEND_ITEMS.filter((item) => item.alwaysShow || visibleKinds.has(item.kind));
  return (
    <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5">
      {items.map((item) => (
        <div key={item.kind} className="inline-flex items-center gap-1.5 text-[11px] text-ink-500">
          <span className={`w-2 h-2 rounded-full ${DOT_STYLES[item.kind]}`} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

export type { MemberEmpNo };
