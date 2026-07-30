import { MEMBER_EMPNOS } from '../lib/members';
import { useAppData } from '../contexts/AppDataContext';
import Avatar from './Avatar';
import { useProfiles } from '../contexts/ProfilesContext';

export default function MePicker() {
  const { setMe, resolveName, namesLoading } = useAppData();
  const { getProfile } = useProfiles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-ink-100 p-6"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-semibold tracking-tight">본인은 누구인가요?</h2>
        <p className="mt-1 text-xs text-ink-500">
          이후 프로필 편집과 먹기록 작성자 표시에 사용돼요. 나중에 바꿀 수 있어요.
        </p>

        <div className="mt-5 space-y-2">
          {MEMBER_EMPNOS.map((empNo) => {
            const name = resolveName(empNo);
            const profile = getProfile(empNo);
            return (
              <button
                key={empNo}
                type="button"
                onClick={() => setMe(empNo)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-ink-200 hover:border-ink-900 hover:bg-ink-50 transition-colors text-left"
              >
                <Avatar profile={profile} size="md" fallbackText={name} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900 truncate">
                    {namesLoading && name === empNo ? '이름 불러오는 중...' : name}
                  </p>
                  <p className="text-[11px] text-ink-400">사번 {empNo}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
