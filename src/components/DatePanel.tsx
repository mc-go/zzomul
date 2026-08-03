import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LuX } from 'react-icons/lu';
import Avatar from './Avatar';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import { MEMBER_EMPNOS, EXTRA_PARTICIPANTS } from '../lib/members';
import { KIND_STYLES, kindFor, labelFor } from '../lib/attendance-status';
import type { AttendanceRecord } from '../lib/attendance';

type Props = {
  date: Date;
  recordsByEmpNo: Record<string, AttendanceRecord | undefined>;
  onClose: () => void;
};

export default function DatePanel({ date, recordsByEmpNo, onClose }: Props) {
  const { getProfileByEmpNo, getStatus } = useProfiles();
  const { resolveName } = useAppData();

  const dateLabel = format(date, 'yyyy년 M월 d일 (EEE)', { locale: ko });
  const dateStr = format(date, 'yyyy-MM-dd');

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
          {[
            ...MEMBER_EMPNOS,
            // 게스트/퇴사자는 그 날짜에 상태 메시지 있을 때만 노출
            ...EXTRA_PARTICIPANTS.filter((e) => getStatus(e.id, dateStr)).map((e) => e.id),
          ].map((empNo) => {
            const record = recordsByEmpNo[empNo] ?? null;
            const profile = getProfileByEmpNo(empNo);
            const name = resolveName(empNo);
            const kind = record ? kindFor(record.attendanceStatus) : 'other';
            const label = record ? labelFor(record.attendanceStatus) : '기록 없음';
            const statusMessage = getStatus(empNo, dateStr);
            const isExtra = (EXTRA_PARTICIPANTS as readonly { id: string }[]).some(
              (e) => e.id === empNo,
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
        </div>
      </aside>
    </>
  );
}
