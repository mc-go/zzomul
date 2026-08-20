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
  ANNIV_STYLES,
  type AnniversaryOccurrence,
} from '../lib/anniversaries';
import { useAnniversaries } from '../contexts/AnniversariesContext';
import { ensureSchema as ensureLunchesSchema, listLunches, type Lunch } from '../lib/lunches';
import {
  deleteLunchPlan,
  ensureLunchPlansSchema,
  listLunchPlans,
  skipRecurringLunchPlan,
  upsertLunchPlan,
  RECURRING_LUNCH_PLANS,
  type LunchPlan,
} from '../lib/lunch-plans';
import { holidayName } from '../lib/holidays';
import {
  DOT_STYLES,
  KIND_STYLES,
  LEGEND_ITEMS,
  kindFor,
  labelForRecord,
} from '../lib/attendance-status';
import {
  buildLunchesByDate,
  buildPlansByDate,
  computeDosirakStats,
} from '../lib/lunch-stats';
import CalendarWidgets from '../components/CalendarWidgets';
import { EXTRA_PARTICIPANTS, MEMBER_EMPNOS, type MemberEmpNo } from '../lib/members';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import Avatar from '../components/Avatar';
import MemberProfileModal from '../components/MemberProfileModal';
import DatePanel from '../components/DatePanel';

const WEEKDAYS = ['월', '화', '수', '목', '금'];

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
  // "오늘" 기준일 — 탭을 며칠 켜둬도 복귀 시 갱신되도록 state로 관리
  // (도시락 리포트의 "오늘까지" 판정과 캘린더 오늘 하이라이트가 이 값을 씀)
  const [todayKey, setTodayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    // 탭 복귀(visibilitychange)·창 포커스 시 날짜가 넘어갔으면 갱신.
    // 같은 날이면 문자열이 동일해 setState가 리렌더를 일으키지 않음.
    const syncToday = () => {
      if (document.visibilityState === 'hidden') return;
      setTodayKey(format(new Date(), 'yyyy-MM-dd'));
    };
    document.addEventListener('visibilitychange', syncToday);
    window.addEventListener('focus', syncToday);
    return () => {
      document.removeEventListener('visibilitychange', syncToday);
      window.removeEventListener('focus', syncToday);
    };
  }, []);

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

  // 각 먹기록이 캘린더에 얹힐 날짜 (wishlist는 plannedDate, done은 date)
  const lunchesByDate = useMemo(() => buildLunchesByDate(calendarLunches), [calendarLunches]);

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
  // todayKey에서 파생 — 'T00:00:00'을 붙이면 로컬 자정으로 파싱됨 (isSameDay 비교용)
  const today = useMemo(() => new Date(`${todayKey}T00:00:00`), [todayKey]);

  const gridDays = useMemo(() => {
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d));
  }, [monthStart, monthEnd]);

  const monthDays = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }).filter((d) => !isWeekend(d)),
    [monthStart, monthEnd],
  );

  // 날짜별 점심 약속: DB 약속 + 매주 고정 약속 합성 (로직은 lunch-stats.ts 참고)
  const plansByDate = useMemo(
    () => buildPlansByDate(lunchPlans, gridDays, byMember),
    [lunchPlans, gridDays, byMember],
  );

  // 이번 달 도시락 리포트: 사람별 집계 (판정 규칙은 lunch-stats.ts 참고)
  const dosirakStats = useMemo(
    () => computeDosirakStats(monthDays, lunchesByDate, plansByDate, byMember, todayKey),
    [monthDays, lunchesByDate, plansByDate, byMember, todayKey],
  );

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

      {/* 오늘 요약 위젯 — 전부 "오늘" 기준이라 보는 달과 무관하게 항상 표시 */}
      <CalendarWidgets todayKey={todayKey} />

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
                    onClick={() => inMonth && setSelectedDate(day)}
                    className={`relative min-h-[110px] border-t border-l border-ink-100 first:border-l-0 p-2 flex flex-col gap-1.5 transition-colors ${
                      inMonth
                        ? // 멤버 행(.cell-item) 위에서만 제외, 나머지(빈 공간·날짜 숫자·뱃지)는 하이라이트
                          'bg-white cursor-pointer [&:hover:not(:has(.cell-item:hover))]:bg-pretzel/20'
                        : 'bg-ink-50/40'
                    } ${isToday ? 'ring-2 ring-inset ring-pretzel' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        disabled={!inMonth}
                        onClick={() => inMonth && setSelectedDate(day)}
                        className={`text-xs font-medium rounded px-1 -mx-1 disabled:cursor-default ${
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
                          const label = record ? labelForRecord(record) : '';
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
                              onClick={(e) => {
                                // 셀 클릭(날짜 상세 열기)으로 전파되면 모달이 겹치므로 차단
                                e.stopPropagation();
                                setSelected({ empNo, date: day, record: record ?? null });
                              }}
                              className={`cell-item flex items-center gap-1.5 text-[11px] leading-tight pl-1 pr-1.5 py-0.5 rounded border cursor-pointer hover:brightness-95 ${
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
                  onClick={() => setSelectedDate(day)}
                  className={`rounded-2xl border bg-white p-3 shadow-card cursor-pointer transition-colors active:bg-pretzel/20 ${
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
                      const label = record ? labelForRecord(record) : '';
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
                          onClick={(e) => {
                            // 카드 클릭(날짜 상세 열기)으로 전파되면 모달이 겹치므로 차단
                            e.stopPropagation();
                            setSelected({ empNo, date: day, record: record ?? null });
                          }}
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
            🍜·🍽️는 예정 포함, 🍱는 오늘까지 지난 평일({dosirakStats.counted}일) 기준이고
            연차·오전 반차로 점심에 없던 날은 빼요 · 도시락 하루 = 외식 한 끼 8,000원 절약으로
            계산했어요
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
          anniversaries={annivByDate[format(selectedDate, 'yyyy-MM-dd')] ?? []}
          isDosirak={isDosirakDay(format(selectedDate, 'yyyy-MM-dd'))}
          myEmpNo={myPid}
          onSavePlanFor={async (empNo, note) => {
            const key = format(selectedDate, 'yyyy-MM-dd');
            // 고정 약속을 쉬어가던 날(skipped 행)을 빈 메모로 다시 켜면 행을 지워 고정 약속 복구
            const wasSkipped = lunchPlans.some(
              (p) => p.empNo === empNo && p.date === key && p.skipped,
            );
            const isRecurringDay = RECURRING_LUNCH_PLANS.some(
              (r) => r.empNo === empNo && selectedDate.getDay() === r.weekday,
            );
            if (wasSkipped && isRecurringDay && !note.trim()) {
              await deleteLunchPlan(empNo, key);
            } else {
              await upsertLunchPlan(empNo, key, note);
            }
            await refreshLunchPlans();
          }}
          onDeletePlanFor={async (empNo) => {
            const key = format(selectedDate, 'yyyy-MM-dd');
            // 고정 약속(합성)은 지울 DB 행이 없으니 "그날만 쉬어감" 표시를 남긴다
            const plan = (plansByDate[key] ?? []).find((p) => p.empNo === empNo);
            if (plan?.fixed) await skipRecurringLunchPlan(empNo, key);
            else await deleteLunchPlan(empNo, key);
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
