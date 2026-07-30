import { LuX } from 'react-icons/lu';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import Avatar from './Avatar';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import { kindFor, labelFor, KIND_STYLES } from '../lib/attendance-status';
import type { AttendanceRecord } from '../lib/attendance';

type Props = {
  empNo: string;
  date?: Date | null;
  record: AttendanceRecord | null;
  onClose: () => void;
};

export default function MemberProfileModal({ empNo, date, record, onClose }: Props) {
  const { getProfileByEmpNo } = useProfiles();
  const { resolveName } = useAppData();

  const profile = getProfileByEmpNo(empNo);
  const name = resolveName(empNo);
  const kind = record ? kindFor(record.attendanceStatus) : 'other';
  const label = record ? labelFor(record.attendanceStatus) : '기록 없음';
  const statusMessage = profile?.statusMessage ?? '';
  const scheduleTime = record?.scheduleTime ?? '';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-ink-100"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-end px-2 py-2">
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 p-1.5 rounded"
            aria-label="닫기"
          >
            <LuX />
          </button>
        </header>

        <div className="px-6 pb-8 flex flex-col items-center text-center">
          <Avatar profile={profile} size="xl" fallbackText={name} />

          <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
            <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${KIND_STYLES[kind]}`}
            >
              {label}
            </span>
          </div>

          {date ? (
            <p className="text-[11px] text-ink-400 mt-1">
              {format(date, 'yyyy년 M월 d일 (EEE)', { locale: ko })} 기준
              {scheduleTime ? ` · ${scheduleTime}` : ''}
            </p>
          ) : null}

          <div className="w-full mt-6 pt-5 border-t border-ink-100">
            <p className="text-sm font-medium text-ink-500 mb-2">
              오늘의 상태
            </p>
            {statusMessage ? (
              <p className="text-lg text-ink-900 font-medium leading-relaxed whitespace-pre-wrap">
                {statusMessage}
              </p>
            ) : (
              <p className="text-sm text-ink-300">아직 남긴 메시지가 없어요</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
