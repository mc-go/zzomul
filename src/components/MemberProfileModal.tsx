import { LuX } from 'react-icons/lu';
import { FaHeart } from 'react-icons/fa';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import Avatar from './Avatar';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import { kindFor, labelFor, KIND_STYLES } from '../lib/attendance-status';
import { isLateArrival, type AttendanceRecord } from '../lib/attendance';

type Props = {
  empNo: string;
  date?: Date | null;
  record: AttendanceRecord | null;
  onClose: () => void;
};

export default function MemberProfileModal({ empNo, date, record, onClose }: Props) {
  const { getProfileByEmpNo, getStatus } = useProfiles();
  const { resolveName } = useAppData();

  const profile = getProfileByEmpNo(empNo);
  const name = resolveName(empNo);
  const kind = record ? kindFor(record.attendanceStatus) : 'other';
  const label = record ? labelFor(record.attendanceStatus) : '기록 없음';
  const dateStr = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    : '';
  const statusMessage = dateStr ? getStatus(empNo, dateStr) : '';
  // 오늘 이전 날짜는 실제 근무시간(workTime), 오늘/미래는 예정 근무시간(scheduleTime)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) < today : false;
  const timeToShow = isPast
    ? (record?.workTime || record?.scheduleTime || '')
    : (record?.scheduleTime ?? '');
  const late =
    !!record && kind === 'work' && isLateArrival(record.workTime, record.scheduleTime);

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
            {late ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-red-100 bg-red-50 text-red-600 inline-flex items-center gap-1">
                지각
                <FaHeart className="text-red-500 text-[10px]" />
              </span>
            ) : null}
          </div>

          {date ? (
            <p className="text-[11px] text-ink-400 mt-1">
              {format(date, 'yyyy년 M월 d일 (EEE)', { locale: ko })} 기준
              {timeToShow ? ` · ${timeToShow}` : ''}
            </p>
          ) : null}

          <div className="w-full mt-6 pt-5 border-t border-ink-100">
            <p className="text-sm font-medium text-ink-500 mb-2">
              {date ? '이 날의 상태' : '오늘의 상태'}
            </p>
            {statusMessage ? (
              <p className="text-lg text-ink-900 font-medium leading-relaxed whitespace-pre-wrap">
                {statusMessage}
              </p>
            ) : (
              <p className="text-sm text-ink-300">이 날엔 남긴 메시지가 없어요</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
