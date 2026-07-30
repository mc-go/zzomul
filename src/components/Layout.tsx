import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LuCalendarDays, LuUtensils, LuLogOut, LuUserCog } from 'react-icons/lu';
import { GiPretzel } from 'react-icons/gi';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import Avatar from './Avatar';
import ProfileEditor from './ProfileEditor';
import MePicker from './MePicker';

const linkBase =
  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors';
const linkIdle = 'text-ink-500 hover:text-ink-900 hover:bg-ink-50';
const linkActive = 'text-ink-900 bg-ink-100';

export default function Layout() {
  const { session, logout } = useAuth();
  const { getProfile, save } = useProfiles();
  const { me, setMe, resolveName } = useAppData();
  const [editing, setEditing] = useState(false);

  const profileId = me ?? '';
  const myProfile = profileId ? getProfile(profileId) : null;
  const displayName = me ? resolveName(me) : (session?.empNm ?? session?.username ?? '');
  const showPicker = !!session && !me;

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
              onClick={() => (me ? setEditing(true) : setMe(null))}
              className="flex items-center gap-2 h-10 pl-1 pr-2.5 rounded-full hover:bg-ink-50 transition-colors"
              title={me ? '프로필 편집' : '본인 선택'}
            >
              <Avatar profile={myProfile} size="sm" fallbackText={displayName} />
              <span className="hidden sm:inline text-xs text-ink-500 max-w-[120px] truncate">
                {displayName}
              </span>
            </button>
            {me ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('본인 선택을 다시 하시겠어요?')) setMe(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-900 px-2 py-1.5 rounded-md hover:bg-ink-50"
                title="본인 다시 선택"
              >
                <LuUserCog className="text-sm" />
              </button>
            ) : null}
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
          initial={myProfile}
          onClose={() => setEditing(false)}
          onSubmit={async (update) => {
            await save(profileId, update);
            setEditing(false);
          }}
        />
      ) : null}

      {showPicker ? <MePicker /> : null}
    </div>
  );
}
