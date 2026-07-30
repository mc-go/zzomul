import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LuCalendarDays, LuUtensils, LuLogOut } from 'react-icons/lu';
import { GiPretzel } from 'react-icons/gi';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import Avatar from './Avatar';
import ProfileEditor from './ProfileEditor';
import DevInfo from './DevInfo';

const linkBase =
  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors';
const linkIdle = 'text-ink-500 hover:text-ink-900 hover:bg-ink-50';
const linkActive = 'text-ink-900 bg-ink-100';

export default function Layout() {
  const { session, logout } = useAuth();
  const { getProfile, save, saveStatus, getStatus } = useProfiles();
  const { myEmpNo, resolveName } = useAppData();
  const [editing, setEditing] = useState(false);

  const profileId = session?.userId ? String(session.userId) : '';
  const myProfile = profileId ? getProfile(profileId) : null;
  const effectiveEmpNo = myProfile?.empNo || myEmpNo || '';
  const displayName = effectiveEmpNo ? resolveName(effectiveEmpNo) : (session?.username ?? '');

  // 오늘자 상태 메시지 (daily_statuses에서 조회)
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todaysStatus = effectiveEmpNo ? getStatus(effectiveEmpNo, todayStr) : '';

  // ProfileEditor 초기값: 오늘자 상태 메시지로 프리필
  const editorInitial = myProfile
    ? { ...myProfile, empNo: myProfile.empNo || myEmpNo || '', statusMessage: todaysStatus }
    : myEmpNo
      ? {
          id: profileId,
          empNo: myEmpNo,
          email: session?.username ?? '',
          iconKey: 'user',
          colorKey: 'slate',
          photo: '',
          statusMessage: todaysStatus,
          statusDate: null,
          updatedAt: '',
        }
      : null;

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-ink-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-8">
            <span className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight cursor-default select-none">
              <GiPretzel className="text-2xl text-pretzel animate-wiggle hover:animate-float" />
              쪼물랭
            </span>
            <nav className="hidden sm:flex items-center gap-1">
              <NavLink
                to="/calendar"
                className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
              >
                <LuCalendarDays className="text-base" />
                근태
              </NavLink>
              <NavLink
                to="/lunch"
                className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
              >
                <LuUtensils className="text-base" />
                먹기록
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => profileId && setEditing(true)}
              disabled={!profileId}
              className="flex items-center gap-2 h-10 pl-1 pr-2.5 rounded-full hover:bg-ink-50 transition-colors disabled:opacity-50"
              title="내 프로필 편집"
            >
              <Avatar profile={myProfile} size="sm" fallbackText={session?.username} />
              <span className="hidden sm:inline text-xs text-ink-500 max-w-[140px] truncate">
                {session?.username}
              </span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-900 px-2 py-1.5 rounded-md hover:bg-ink-50"
              title="로그아웃"
            >
              <LuLogOut className="text-sm" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 pb-24 sm:pb-8">
        <Outlet />
      </main>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 border-t border-ink-100 bg-white/95 backdrop-blur z-30">
        <div className="grid grid-cols-2">
          <NavLink
            to="/calendar"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-xs ${
                isActive ? 'text-ink-900' : 'text-ink-400'
              }`
            }
          >
            <LuCalendarDays className="text-lg" />
            근태
          </NavLink>
          <NavLink
            to="/lunch"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-xs ${
                isActive ? 'text-ink-900' : 'text-ink-400'
              }`
            }
          >
            <LuUtensils className="text-lg" />
            먹기록
          </NavLink>
        </div>
      </nav>

      {editing && profileId ? (
        <ProfileEditor
          profileId={profileId}
          displayName={displayName}
          initial={editorInitial}
          onClose={() => setEditing(false)}
          onSubmit={async ({ statusMessage, ...profileUpdate }) => {
            await save(profileId, { ...profileUpdate, email: session?.username });
            const empNoForStatus = profileUpdate.empNo || myEmpNo || '';
            if (empNoForStatus) {
              await saveStatus(empNoForStatus, todayStr, statusMessage);
            }
            setEditing(false);
          }}
        />
      ) : null}

      <DevInfo />
    </div>
  );
}
