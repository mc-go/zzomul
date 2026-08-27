import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { fetchAttendances, indexByMemberAndDate, type AttendanceRecord } from '../lib/attendance';
import { kindFor, labelForRecord } from '../lib/attendance-status';
import { HOLIDAYS, hasHolidaysForYear, holidayName } from '../lib/holidays';
import { occurrencesOnDate } from '../lib/anniversaries';
import { ensureReportsSchema, listReportsForDate, type Report } from '../lib/reports';
import { fetchOfficeWeather, type OfficeWeather } from '../lib/weather';
import { MEMBER_EMPNOS } from '../lib/members';
import { useAuth } from '../contexts/AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAnniversaries } from '../contexts/AnniversariesContext';
import Avatar from './Avatar';

// 캘린더 탭 상단 위젯 그리드 — 전부 "오늘" 기준 요약이라 보는 달과 무관하게 표시.
//  - 사무실 온도: 오늘 근태를 별도 1회 조회 (달 이동해도 유지되도록 월 조회와 분리)
//  - 기념일 D-day / 다음 빨간날: 이미 로드된 데이터로 계산만
//  - 오늘의 보고: reports 1회 조회, 클릭하면 보고 탭으로 이동
// 계산만 하고 저장 없음.

export default function CalendarWidgets({ todayKey }: { todayKey: string }) {
  const { session } = useAuth();
  const { resolveName } = useAppData();
  const { getProfileByEmpNo } = useProfiles();
  const { items: anniversaries } = useAnniversaries();
  // null = 아직 조회 전 (게스트는 계속 null → 온도 위젯 숨김)
  const [todayRecords, setTodayRecords] = useState<Record<
    string,
    AttendanceRecord | undefined
  > | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  // 바깥 날씨 — Open-Meteo, 실패하면 그냥 생략 (lib/weather.ts에 30분 캐시)
  const [weather, setWeather] = useState<OfficeWeather | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOfficeWeather().then((w) => {
      if (!cancelled && w) setWeather(w);
    });
    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  // 오늘 근태만 콕 집어 조회 — 캘린더의 월 단위 조회와 독립이라 달을 넘겨도 온도가 유지됨
  useEffect(() => {
    if (!session?.token || session.role !== 'konai') return;
    let cancelled = false;
    fetchAttendances(session.token, todayKey, todayKey)
      .then((rows) => {
        if (cancelled) return;
        const byMember = indexByMemberAndDate(rows);
        setTodayRecords(
          Object.fromEntries(MEMBER_EMPNOS.map((emp) => [emp, byMember[emp]?.[todayKey]])),
        );
      })
      .catch(() => {
        /* 조회 실패 시 온도 위젯만 생략 */
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.role, todayKey]);

  useEffect(() => {
    let cancelled = false;
    ensureReportsSchema()
      .then(() => listReportsForDate(todayKey))
      .then((rows) => {
        if (!cancelled) setReports(rows);
      })
      .catch(() => {
        /* 조회 실패 시 보고 위젯만 "-" 표시 */
      });
    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  return (
    <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
      <TemperatureWidget
        todayKey={todayKey}
        records={todayRecords}
        resolveName={resolveName}
        weather={weather}
      />
      <AnniversaryWidget todayKey={todayKey} />
      <HolidayWidget todayKey={todayKey} />
      <ReportWidget reports={reports} resolveName={resolveName} getProfile={getProfileByEmpNo} />
    </div>
  );

  // 컴포넌트 안에서 anniversaries/resolveName을 클로저로 쓰기 위해 내부 정의
  function AnniversaryWidget({ todayKey }: { todayKey: string }) {
    // 오늘부터 최대 400일 안의 첫 기념일 (입사 100일 단위도 잡히도록 여유 있게)
    const next = useMemo(() => {
      if (anniversaries.length === 0) return null;
      const base = new Date(`${todayKey}T00:00:00`);
      for (let i = 0; i <= 400; i++) {
        const day = addDays(base, i);
        const occ = occurrencesOnDate(anniversaries, day, resolveName);
        if (occ.length > 0) return { occ: occ[0], extra: occ.length - 1, daysUntil: i };
      }
      return null;
    }, [todayKey]);

    return (
      <Widget title="🎂 다가오는 기념일">
        {next ? (
          <>
            {/* 좁은 카드에선 자르지 말고 단어 단위로 줄바꿈 (최대 2줄) */}
            <p className="text-sm font-bold text-ink-900 break-keep line-clamp-2" title={next.occ.text}>
              {next.occ.emoji} {next.occ.text}
              {next.extra > 0 ? ` 외 ${next.extra}건` : ''}
            </p>
            <p
              className={`text-[11px] font-semibold mt-0.5 ${
                next.daysUntil === 0 ? 'text-pink-500' : 'text-ink-500'
              }`}
            >
              {next.daysUntil === 0 ? '🥳 오늘이에요!' : `D-${next.daysUntil}`}
            </p>
          </>
        ) : (
          <p className="text-xs text-ink-400">등록된 기념일이 없어요</p>
        )}
      </Widget>
    );
  }
}

function Widget({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-ink-100 bg-white shadow-card px-2.5 sm:px-3 py-2.5 min-w-0 ${className}`}
    >
      <p className="text-[10px] font-medium text-ink-400">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ----- 사무실 온도 -----
// 근무 1명 = 1, 반차 = 0.5, 휴가/안식휴가 = 0. 기록 없음/기타는 근무로 간주.

const TEMP_LEVELS: { min: number; emoji: string; message: string; bar: string }[] = [
  { min: 100, emoji: '🔥', message: '완전체!', bar: 'bg-orange-400' },
  { min: 67, emoji: '🌤️', message: '거의 다 있어요', bar: 'bg-amber-400' },
  { min: 34, emoji: '🥶', message: '좀 한산해요', bar: 'bg-sky-400' },
  { min: 1, emoji: '❄️', message: '꽤 썰렁해요', bar: 'bg-sky-300' },
  { min: 0, emoji: '❄️', message: '텅 비었어요', bar: 'bg-ink-200' },
];

function presenceScore(record: AttendanceRecord | undefined): number {
  if (!record) return 1;
  const kind = kindFor(record.attendanceStatus);
  if (kind === 'off' || kind === 'sabbatical') return 0;
  if (kind === 'half') return 0.5;
  return 1;
}

function TemperatureWidget({
  todayKey,
  records,
  resolveName,
  weather,
}: {
  todayKey: string;
  records: Record<string, AttendanceRecord | undefined> | null;
  resolveName: (id: string) => string;
  weather: OfficeWeather | null;
}) {
  const today = new Date(`${todayKey}T00:00:00`);
  const weekday = today.getDay();
  const holiday = holidayName(todayKey);
  const isRestDay = weekday === 0 || weekday === 6 || !!holiday;

  // 바깥 실제 날씨 한 줄 — 쉬는 날/게스트 상태에서도 공통으로 표시
  const weatherLine = weather ? (
    <p className="text-[10px] text-ink-400 mt-1 whitespace-nowrap">
      바깥은 {weather.emoji} {Math.round(weather.temp)}° {weather.label}
    </p>
  ) : null;

  if (isRestDay) {
    return (
      <Widget title="🌡️ 사무실 온도">
        <p className="text-sm font-bold text-ink-900">😴 쉬는 날</p>
        <p className="text-[11px] text-ink-500 mt-0.5 break-keep">
          {holiday ? `${holiday} — 푹 쉬어요!` : '주말 — 푹 쉬어요!'}
        </p>
        {weatherLine}
      </Widget>
    );
  }

  // 게스트거나 아직 조회 전이면 자리만 유지
  if (!records) {
    return (
      <Widget title="🌡️ 사무실 온도">
        <p className="text-sm font-bold text-ink-300">--°</p>
        {weatherLine}
      </Widget>
    );
  }

  const score = MEMBER_EMPNOS.reduce((sum, emp) => sum + presenceScore(records[emp]), 0);
  const temp = Math.round((score / MEMBER_EMPNOS.length) * 100);
  const level = TEMP_LEVELS.find((l) => temp >= l.min) ?? TEMP_LEVELS[TEMP_LEVELS.length - 1];
  // 자리 비우는 멤버는 "이름 사유"로 압축 표기
  const away = MEMBER_EMPNOS.filter((emp) => presenceScore(records[emp]) < 1).map((emp) => {
    const r = records[emp];
    return `${resolveName(emp)} ${r ? labelForRecord(r) : ''}`.trim();
  });

  return (
    <Widget title="🌡️ 사무실 온도">
      {/* 온도와 메시지를 분리 — 좁은 카드에선 메시지가 통째로 다음 줄로 내려가게 */}
      <div className="flex items-baseline gap-x-1.5 flex-wrap">
        <p className="text-sm font-bold text-ink-900 whitespace-nowrap">
          {level.emoji} {temp}°
        </p>
        <p className="text-[11px] font-medium text-ink-500 break-keep">{level.message}</p>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-ink-50 border border-ink-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${level.bar}`}
          style={{ width: `${Math.max(temp, 4)}%` }}
        />
      </div>
      <p className="text-[10px] text-ink-400 mt-1 break-keep leading-snug" title={away.join(' · ')}>
        {away.length > 0 ? away.join(' · ') : '오늘은 다 모였어요 👏'}
      </p>
      {weatherLine}
    </Widget>
  );
}

// ----- 다음 빨간날 -----

function HolidayWidget({ todayKey }: { todayKey: string }) {
  // 오늘 포함 가장 가까운 공휴일 (오늘이 공휴일이면 "오늘!")
  const next = useMemo(() => {
    const keys = Object.keys(HOLIDAYS)
      .filter((k) => k >= todayKey)
      .sort();
    if (keys.length === 0) return null;
    const date = keys[0];
    const daysUntil = differenceInCalendarDays(
      new Date(`${date}T00:00:00`),
      new Date(`${todayKey}T00:00:00`),
    );
    return { date, name: HOLIDAYS[date], daysUntil };
  }, [todayKey]);

  // 12월인데 다음 해 공휴일이 아직 없으면 경고 — holidays.ts 수동 관리를 잊지 않기 위한 안전장치
  const missingNextYear = useMemo(() => {
    const d = new Date(`${todayKey}T00:00:00`);
    return d.getMonth() === 11 && !hasHolidaysForYear(d.getFullYear() + 1)
      ? d.getFullYear() + 1
      : null;
  }, [todayKey]);

  return (
    <Widget title="📅 다음 빨간날">
      {next ? (
        <>
          <p className="text-sm font-bold text-ink-900 break-keep line-clamp-2" title={next.name}>
            ❤️ {next.name}
          </p>
          <p
            className={`text-[11px] font-semibold mt-0.5 ${
              next.daysUntil === 0 ? 'text-red-500' : 'text-ink-500'
            }`}
          >
            {next.daysUntil === 0
              ? '🎉 오늘이에요!'
              : `D-${next.daysUntil} · ${format(new Date(`${next.date}T00:00:00`), 'M/d (EEE)', { locale: ko })}`}
          </p>
        </>
      ) : (
        // holidays.ts에 다음 해 날짜를 아직 안 넣은 연말에 보이는 상태
        <p className="text-xs text-ink-400">등록된 빨간날이 없어요 😢</p>
      )}
      {missingNextYear ? (
        <p className="text-[10px] text-red-400 mt-1 break-keep">
          ⚠️ {missingNextYear}년 공휴일이 아직 없어요 — holidays.ts에 추가해 주세요
        </p>
      ) : null}
    </Widget>
  );
}

// ----- 오늘의 보고 현황 -----

function ReportWidget({
  reports,
  resolveName,
  getProfile,
}: {
  reports: Report[] | null;
  resolveName: (id: string) => string;
  getProfile: (id: string) => import('../lib/profiles').Profile | null;
}) {
  const writers = new Set((reports ?? []).map((r) => r.authorId));
  const done = MEMBER_EMPNOS.filter((emp) => writers.has(emp));

  return (
    <Link to="/report" className="block min-w-0">
      <Widget title="📢 오늘의 보고" className="hover:border-pretzel/40 transition-colors h-full">
        {reports === null ? (
          <p className="text-sm font-bold text-ink-300">-</p>
        ) : (
          <>
            <p className="text-sm font-bold text-ink-900">
              {done.length}/{MEMBER_EMPNOS.length}명 작성
            </p>
            {done.length > 0 ? (
              <div className="mt-1 flex items-center gap-0.5 flex-wrap">
                {done.map((emp) => (
                  <Avatar
                    key={emp}
                    profile={getProfile(emp)}
                    size="xs"
                    fallbackText={resolveName(emp)}
                  />
                ))}
                {done.length === MEMBER_EMPNOS.length ? (
                  <span className="ml-1 text-[10px] text-ink-500">다들 부지런해요 😉</span>
                ) : null}
              </div>
            ) : (
              <p className="text-[10px] text-ink-400 mt-0.5">아직 아무도 안 썼어요 ✍️</p>
            )}
          </>
        )}
      </Widget>
    </Link>
  );
}
