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
import {
  fetchAttendances,
  indexByMemberAndDate,
  type AttendanceRecord,
} from '../lib/attendance';
import {
  DOT_STYLES,
  KIND_STYLES,
  LEGEND_ITEMS,
  kindFor,
  labelFor,
} from '../lib/attendance-status';
import { MEMBER_EMPNOS, type MemberEmpNo } from '../lib/members';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import Avatar from '../components/Avatar';
import MemberProfileModal from '../components/MemberProfileModal';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function CalendarPage() {
  const { session, logout } = useAuth();
  const { getProfile } = useProfiles();
  const { resolveName } = useAppData();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ empNo: string; date: Date; record: AttendanceRecord | null } | null>(null);

  const monthStart = useMemo(() => startOfMonth(cursor), [cursor]);
  const monthEnd = useMemo(() => endOfMonth(cursor), [cursor]);

  useEffect(() => {
    if (!session?.token) return;
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
  }, [session?.token, monthStart, monthEnd, logout]);

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
    return eachDayOfInterval({ start, end });
  }, [monthStart, monthEnd]);

  const monthDays = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthStart, monthEnd],
  );

  const hasAnyStatus = MEMBER_EMPNOS.some((emp) => (getProfile(emp)?.statusMessage ?? '').length > 0);

  return (
    <div>
      {hasAnyStatus ? (
        <section className="mb-6">
          <h2 className="text-[11px] font-medium text-ink-400 mb-2 tracking-wide uppercase">오늘의 상태</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {MEMBER_EMPNOS.map((emp) => {
              const profile = getProfile(emp);
              const name = resolveName(emp);
              const msg = profile?.statusMessage ?? '';
              const todayKey = format(new Date(), 'yyyy-MM-dd');
              const todayRecord = byMember[emp]?.[todayKey] ?? null;
              return (
                <button
                  key={emp}
                  type="button"
                  onClick={() => setSelected({ empNo: emp, date: new Date(), record: todayRecord })}
                  className="flex items-center gap-2.5 rounded-lg border border-ink-100 bg-white px-3 py-2 hover:border-ink-200 hover:bg-ink-50/40 transition-colors text-left"
                >
                  <Avatar profile={profile} size="sm" fallbackText={name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink-700 truncate">{name}</p>
                    <p className="text-[11px] text-ink-500 truncate">
                      {msg || <span className="text-ink-300">·</span>}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

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
          <section className="hidden md:block rounded-lg border border-ink-100 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-ink-100 bg-ink-50/60">
              {WEEKDAYS.map((day, i) => (
                <div
                  key={day}
                  className={`px-2 py-2 text-[11px] font-medium ${
                    i >= 5 ? 'text-ink-400' : 'text-ink-500'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {gridDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const inMonth = isSameMonth(day, cursor);
                const isToday = isSameDay(day, today);
                const weekend = isWeekend(day);
                return (
                  <div
                    key={dateKey}
                    className={`relative min-h-[110px] border-t border-l border-ink-100 first:border-l-0 p-2 flex flex-col gap-1.5 ${
                      inMonth ? 'bg-white' : 'bg-ink-50/40'
                    } ${isToday ? 'ring-2 ring-inset ring-ink-900' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          !inMonth
                            ? 'text-ink-300'
                            : isToday
                              ? 'text-ink-900'
                              : weekend
                                ? 'text-ink-400'
                                : 'text-ink-700'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {isToday ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-ink-900 text-white">
                          오늘
                        </span>
                      ) : null}
                    </div>
                    {inMonth ? (
                      <ul className="space-y-1">
                        {MEMBER_EMPNOS.map((empNo) => {
                          const record = byMember[empNo]?.[dateKey];
                          const kind = record ? kindFor(record.attendanceStatus) : 'other';
                          const label = record ? labelFor(record.attendanceStatus) : '';
                          const name = resolveName(empNo);
                          const profile = getProfile(empNo);
                          return (
                            <li
                              key={empNo}
                              onClick={() => setSelected({ empNo, date: day, record: record ?? null })}
                              className={`flex items-center gap-1.5 text-[11px] leading-tight pl-1 pr-1.5 py-0.5 rounded border cursor-pointer hover:brightness-95 ${
                                record ? KIND_STYLES[kind] : 'bg-transparent text-ink-300 border-transparent'
                              }`}
                              title={record ? `${name} · ${label}` : name}
                            >
                              <Avatar profile={profile} size="xs" fallbackText={name} />
                              <span className="truncate">{name}</span>
                              {label ? <span className="ml-auto text-[10px]">{label}</span> : null}
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
              const weekend = isWeekend(day);
              const isToday = isSameDay(day, today);
              return (
                <article
                  key={dateKey}
                  className={`rounded-lg border bg-white p-3 ${
                    isToday ? 'border-ink-900 border-2' : 'border-ink-100'
                  }`}
                >
                  <header className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-sm font-semibold ${
                        weekend ? 'text-ink-400' : 'text-ink-900'
                      }`}
                    >
                      {format(day, 'd일 (EEE)', { locale: ko })}
                    </span>
                    {isToday ? (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-ink-900 text-white">
                        오늘
                      </span>
                    ) : null}
                  </header>
                  <ul className="grid grid-cols-1 gap-1.5">
                    {MEMBER_EMPNOS.map((empNo) => {
                      const record = byMember[empNo]?.[dateKey];
                      const kind = record ? kindFor(record.attendanceStatus) : 'other';
                      const label = record ? labelFor(record.attendanceStatus) : '';
                      const name = resolveName(empNo);
                      const profile = getProfile(empNo);
                      return (
                        <li
                          key={empNo}
                          onClick={() => setSelected({ empNo, date: day, record: record ?? null })}
                          className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border cursor-pointer active:brightness-95 ${
                            record ? KIND_STYLES[kind] : 'bg-ink-50/40 text-ink-300 border-ink-100'
                          }`}
                        >
                          <Avatar profile={profile} size="xs" fallbackText={name} />
                          <span className="font-medium">{name}</span>
                          <span className="ml-auto">{label || '기록 없음'}</span>
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

      {selected ? (
        <MemberProfileModal
          empNo={selected.empNo}
          date={selected.date}
          record={selected.record}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
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
