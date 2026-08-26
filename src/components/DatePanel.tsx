import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LuX, LuPencil, LuTrash2 } from 'react-icons/lu';
import Avatar from './Avatar';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import { MEMBER_EMPNOS, EXTRA_PARTICIPANTS } from '../lib/members';
import { KIND_STYLES, isAwayAtLunch, kindFor, labelForRecord } from '../lib/attendance-status';
import { holidayName } from '../lib/holidays';
import type { AttendanceRecord } from '../lib/attendance';
import type { LunchPlan } from '../lib/lunch-plans';
import type { Lunch } from '../lib/lunches';
import { ANNIV_STYLES, type AnniversaryOccurrence } from '../lib/anniversaries';

type Props = {
  date: Date;
  recordsByEmpNo: Record<string, AttendanceRecord | undefined>;
  plans: LunchPlan[];
  lunches: Lunch[]; // 그 날짜의 먹기록 (점심: 참여자별 쪼물런치 판단, 저녁: 쪼물디너 섹션)
  anniversaries: AnniversaryOccurrence[]; // 그 날짜의 기념일
  isDosirak: boolean; // 쪼물런치도 약속도 없는 날 = 도시락 날 (상세에서만 표시)
  myEmpNo: string; // 없으면(게스트 등) 약속 등록 UI 숨김
  onSavePlanFor: (empNo: string, note: string) => Promise<void>;
  onDeletePlanFor: (empNo: string) => Promise<void>;
  onClose: () => void;
};

// 그 사람의 그날 점심: 개인 약속 > 쪼물런치 참여 > 도시락(기본) 순으로 판단.
// 쪼물런치 참여자는 라벨 생략 (위 섹션 배너로 충분) — 도시락 ↔ 약속만 클릭 토글.
// 연차·오전 반차 등으로 점심시간에 회사에 없으면 라벨 자체를 표시하지 않음.
function lunchChipFor(
  empNo: string,
  plans: LunchPlan[],
  lunches: Lunch[],
  isHoliday: boolean,
  isExtra: boolean,
  awayAtLunch: boolean,
): { kind: 'plan' | 'dosirak'; text: string; cls: string; title: string } | null {
  if (awayAtLunch) return null;
  const plan = plans.find((p) => p.empNo === empNo);
  if (plan) {
    return {
      kind: 'plan',
      text: '🍽️ 약속',
      cls: 'bg-teal-50 text-teal-700 border-teal-100',
      title: plan.note ? `점심 약속 · ${plan.note}` : '점심 약속',
    };
  }
  const inZzomulLunch = lunches.some(
    (l) =>
      l.meal === 'lunch' &&
      (l.participants.length === 0 || (l.participants as readonly string[]).includes(empNo)),
  );
  if (inZzomulLunch) return null;
  // 게스트/퇴사자와 공휴일엔 도시락 표시 안 함
  if (isExtra || isHoliday) return null;
  return {
    kind: 'dosirak',
    text: '🍱 도시락',
    cls: 'bg-lime-50 text-lime-700 border-lime-100',
    title: '쪼물런치도 약속도 없는 날 — 도시락!',
  };
}

export default function DatePanel({
  date,
  recordsByEmpNo,
  plans,
  lunches,
  anniversaries,
  isDosirak,
  myEmpNo,
  onSavePlanFor,
  onDeletePlanFor,
  onClose,
}: Props) {
  const { getProfileByEmpNo, getStatus } = useProfiles();
  const { resolveName } = useAppData();
  const [chipBusy, setChipBusy] = useState<string | null>(null);

  const dateLabel = format(date, 'yyyy년 M월 d일 (EEE)', { locale: ko });
  const dateStr = format(date, 'yyyy-MM-dd');

  // 라벨 클릭 시 토글: 도시락 ↔ 약속 (쪼물런치는 먹기록 기준이라 여기서 안 바뀜)
  async function toggleLunchType(empNo: string) {
    if (chipBusy) return;
    setChipBusy(empNo);
    try {
      const plan = plans.find((p) => p.empNo === empNo);
      if (plan) {
        await onDeletePlanFor(empNo); // 약속 → 도시락 (고정 약속이면 그날만 쉬어감 처리)
      } else {
        await onSavePlanFor(empNo, ''); // 도시락 → 약속 (메모는 위 섹션에서 수정)
      }
    } finally {
      setChipBusy(null);
    }
  }

  return (
    <>
      {/* 모바일 백드롭 */}
      <div
        className="md:hidden fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 데스크톱: 좌측 드로어 (헤더 아래) / 모바일: 바텀시트 */}
      <aside
        className="fixed z-50 bg-white shadow-2xl border-ink-200 flex flex-col
          bottom-0 inset-x-0 rounded-t-2xl max-h-[75vh] border
          md:inset-x-auto md:top-14 md:left-0 md:bottom-0 md:w-[360px] md:max-h-none md:rounded-none md:border-r"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
          <div>
            <p className="text-[10px] font-medium text-ink-400 tracking-wide uppercase mb-0.5">
              선택된 날짜
            </p>
            <h2 className="text-sm font-semibold">{dateLabel}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 p-1.5 rounded"
            aria-label="닫기"
          >
            <LuX />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {/* 순서: 기념일 → 점심 → 멤버별 근태 → 쪼물디너 */}
          {anniversaries.length > 0 ? (
            <section className="rounded-lg border border-pink-100 bg-pink-50/40 p-3">
              <h3 className="text-[11px] font-semibold text-pink-600 mb-1.5">🎉 이날의 기념일</h3>
              <ul className="flex flex-wrap gap-1.5">
                {anniversaries.map((a) => (
                  <li
                    key={a.key}
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${ANNIV_STYLES[a.kind]}`}
                  >
                    {a.emoji} {a.text}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <LunchPlanSection
            plans={plans}
            dayLunch={lunches.find((l) => l.meal === 'lunch') ?? null}
            isDosirak={isDosirak}
            myEmpNo={myEmpNo}
            resolveName={resolveName}
            getProfileByEmpNo={getProfileByEmpNo}
            onSave={(note) => onSavePlanFor(myEmpNo, note)}
            onDelete={() => onDeletePlanFor(myEmpNo)}
          />

          {[
            ...MEMBER_EMPNOS,
            // 게스트/퇴사자는 그 날짜에 상태 메시지 있을 때만 노출
            ...EXTRA_PARTICIPANTS.filter((e) => getStatus(e.id, dateStr)).map((e) => e.id),
          ].map((empNo) => {
            const record = recordsByEmpNo[empNo] ?? null;
            const profile = getProfileByEmpNo(empNo);
            const name = resolveName(empNo);
            const kind = record ? kindFor(record.attendanceStatus) : 'other';
            const label = record ? labelForRecord(record) : '기록 없음';
            const statusMessage = getStatus(empNo, dateStr);
            const isExtra = (EXTRA_PARTICIPANTS as readonly { id: string }[]).some(
              (e) => e.id === empNo,
            );
            const lunchChip = lunchChipFor(
              empNo,
              plans,
              lunches,
              !!holidayName(dateStr),
              isExtra,
              isAwayAtLunch(record),
            );

            return (
              <div
                key={empNo}
                className="rounded-lg border border-ink-100 p-3 flex items-start gap-3"
              >
                <Avatar profile={profile} size="md" fallbackText={name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink-900">{name}</span>
                    {isExtra ? (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-600 border-violet-100">
                        게스트
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${KIND_STYLES[kind]}`}
                      >
                        {label}
                      </span>
                    )}
                    {lunchChip ? (
                      isExtra || empNo !== myEmpNo ? (
                        // 남의 라벨은 표시만 — 토글은 내 것만 가능
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${lunchChip.cls}`}
                          title={lunchChip.title}
                        >
                          {lunchChip.text}
                        </span>
                      ) : (
                        // 클릭하면 도시락 ↔ 약속 토글
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleLunchType(empNo);
                          }}
                          disabled={chipBusy === empNo}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 ${lunchChip.cls}`}
                          title={`${lunchChip.title} · 클릭하면 ${lunchChip.kind === 'plan' ? '도시락으로' : '약속으로'} 바뀌어요`}
                        >
                          {chipBusy === empNo ? '...' : lunchChip.text}
                        </button>
                      )
                    ) : null}
                  </div>
                  {record?.scheduleTime ? (
                    <p className="text-[11px] text-ink-400 mt-0.5">{record.scheduleTime}</p>
                  ) : null}
                  {statusMessage ? (
                    <p className="text-xs text-ink-600 mt-2 leading-relaxed whitespace-pre-wrap">
                      {statusMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}

          {lunches.some((l) => l.meal === 'dinner') ? (
            <section className="rounded-lg border border-accent/20 bg-accent-soft/40 p-3">
              <h3 className="text-[11px] font-semibold text-accent mb-1.5">🌙 쪼물디너</h3>
              <ul className="space-y-1">
                {lunches
                  .filter((l) => l.meal === 'dinner')
                  .map((l) => (
                    <li key={l.id} className="text-xs text-ink-700">
                      <b>{l.restaurant}</b>
                      {l.delivery ? <span className="text-ink-400"> · 배달</span> : null}
                      {/* 메뉴는 '-' 구분자마다 줄바꿈 — 각 줄은 '- '로 시작 (원문에 -가 있어도 중복 안 붙음) */}
                      {l.menu
                        ? l.menu
                            .split('-')
                            .map((part) => part.trim())
                            .filter(Boolean)
                            .map((part, i) => (
                              <p key={i} className="text-ink-500 mt-0.5">
                                - {part}
                              </p>
                            ))
                        : null}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
        </div>
      </aside>
    </>
  );
}

// 🍱 이날의 점심 약속: 각자 자기 약속만 등록/삭제할 수 있고, 다른 사람 것도 함께 보임.
// 쪼물런치가 아닌 개인 외식 약속을 서로 미리 알 수 있게 하는 용도.
function LunchPlanSection({
  plans,
  dayLunch,
  isDosirak,
  myEmpNo,
  resolveName,
  getProfileByEmpNo,
  onSave,
  onDelete,
}: {
  plans: LunchPlan[];
  dayLunch: Lunch | null; // 그날의 쪼물런치 기록 (있으면 약속 없어도 쪼물런치 날로 안내)
  isDosirak: boolean;
  myEmpNo: string;
  resolveName: (id: string) => string;
  getProfileByEmpNo: (id: string) => import('../lib/profiles').Profile | null;
  onSave: (note: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const myPlan = myEmpNo ? plans.find((p) => p.empNo === myEmpNo) ?? null : null;
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(myPlan?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave(note);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    if (!confirm('이날 점심 약속 표시를 지울까요?')) return;
    setBusy(true);
    setErr(null);
    try {
      await onDelete();
      setEditing(false);
      setNote('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-teal-100 bg-teal-50/40 p-3">
      <h3 className="text-[11px] font-semibold text-teal-700 mb-2">🍽️ 이날의 점심 약속</h3>

      {plans.length > 0 ? (
        <ul className="space-y-1.5 mb-2">
          {plans.map((p) => (
            <li key={p.empNo} className="flex items-center gap-2 text-xs text-ink-700">
              <Avatar
                profile={getProfileByEmpNo(p.empNo)}
                size="xs"
                fallbackText={resolveName(p.empNo)}
              />
              <span className="font-medium shrink-0">{resolveName(p.empNo)}</span>
              <span className="text-ink-500 min-w-0 flex-1 break-keep">
                {p.note ? p.note : '따로 약속 있어요'}
              </span>
              {p.fixed ? (
                <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-white text-teal-600 border-teal-200">
                  매주 고정
                </span>
              ) : null}
              {myEmpNo && p.empNo === myEmpNo ? (
                <span className="ml-auto inline-flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setNote(p.note);
                      setEditing(true);
                    }}
                    className="text-ink-300 hover:text-ink-900 p-1 rounded hover:bg-white"
                    aria-label="약속 수정"
                    title="수정"
                  >
                    <LuPencil className="text-xs" />
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy}
                    className="text-ink-300 hover:text-red-600 p-1 rounded hover:bg-white"
                    aria-label="약속 삭제"
                    title="삭제"
                  >
                    <LuTrash2 className="text-xs" />
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : dayLunch ? (
        <p className="text-[11px] text-amber-700 mb-2 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-1.5">
          {dayLunch.delivery ? '🛵' : '🍜'} 드디어 쪼물런치! <b>{dayLunch.restaurant}</b> 즐겨
          봐요😋
        </p>
      ) : isDosirak ? (
        <p className="text-[11px] text-lime-700 mb-2 rounded-lg bg-lime-50 border border-lime-100 px-2.5 py-1.5">
          🍱 쪼물런치도 약속도 없는 날 — 도시락 먹는 날이에요!
        </p>
      ) : (
        <p className="text-[11px] text-ink-400 mb-2">아직 등록된 약속이 없어요.</p>
      )}

      {/* 약속 등록은 아래 이름 옆 라벨 클릭으로 통일 — 여기선 내 약속 메모 수정만 */}
      {myEmpNo && editing ? (
        <form onSubmit={submit} className="flex items-center gap-1.5">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="누구랑? 어디서? (선택)"
            className="flex-1 min-w-0 h-8 px-2.5 rounded-full border border-teal-200 text-[11px] placeholder-ink-300 bg-white"
            autoFocus
          />
          <button
            type="submit"
            disabled={busy}
            className="h-8 px-3 shrink-0 rounded-full bg-teal-600 text-white text-[11px] font-medium hover:bg-teal-700 disabled:opacity-60"
          >
            {busy ? '저장 중...' : '저장'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-8 px-2 shrink-0 rounded-full text-[11px] text-ink-400 hover:text-ink-900"
          >
            취소
          </button>
        </form>
      ) : !dayLunch && myEmpNo ? (
        // 쪼물런치 날엔 토글이 없으므로 안내도 숨김
        <p className="text-[10px] text-ink-400">
          💡 내 점심 라벨을 누르면 🍱 도시락 ↔ 🍽️ 약속으로 바뀌어요
        </p>
      ) : null}

      {err ? <p className="mt-1.5 text-[11px] text-red-600">{err}</p> : null}
    </section>
  );
}
