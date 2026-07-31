import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LuCalendarDays, LuUtensils, LuLogOut, LuMegaphone, LuSettings, LuGift } from 'react-icons/lu';
import { GiPretzel } from 'react-icons/gi';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import { useAnniversaries } from '../contexts/AnniversariesContext';
import Avatar from './Avatar';
import ProfileEditor from './ProfileEditor';
import DevInfo from './DevInfo';
import DailyPopup from './DailyPopup';
import AnniversaryManager from './AnniversaryManager';
import FloatingBreads from './FloatingBreads';

const linkBase =
  'flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-colors';
const linkIdle = 'text-ink-500 hover:text-pretzel hover:bg-pretzel/5';
const linkActive = 'text-pretzel bg-pretzel/10';

export default function Layout() {
  const { session, logout } = useAuth();
  const location = useLocation();
  const [logoSpin, setLogoSpin] = useState(false);
  const { getProfile, save, saveStatus, getStatus } = useProfiles();
  const { myEmpNo, resolveName } = useAppData();
  const { items: anniversaries, refresh: refreshAnniversaries } = useAnniversaries();
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [annivOpen, setAnnivOpen] = useState(false);

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
      <header className="sticky top-0 z-30 bg-[#fdfaf3]/90 backdrop-blur border-b border-pretzel/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-8">
            {/* 로고 클릭 시 프레첼이 한 바퀴 스핀 */}
            <button
              type="button"
              onClick={() => setLogoSpin(true)}
              className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight select-none"
            >
              <GiPretzel
                className={`text-2xl text-pretzel ${logoSpin ? 'animate-spinonce' : 'animate-wiggle'}`}
                onAnimationEnd={() => logoSpin && setLogoSpin(false)}
              />
              쪼물랭
            </button>
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
              <NavLink
                to="/report"
                className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
              >
                <LuMegaphone className="text-base" />
                보고
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
            {/* 설정 메뉴 (기념일 설정 등) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-900 px-2 py-1.5 rounded-md hover:bg-ink-50"
                title="설정"
                aria-haspopup="menu"
                aria-expanded={settingsOpen}
              >
                <LuSettings className="text-sm" />
              </button>
              {settingsOpen ? (
                <>
                  {/* 바깥 클릭 시 닫힘 */}
                  <div className="fixed inset-0 z-30" onClick={() => setSettingsOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-40 w-40 rounded-lg border border-ink-100 bg-white shadow-lg py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsOpen(false);
                        setAnnivOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                    >
                      <LuGift className="text-sm" />
                      기념일 설정
                    </button>
                  </div>
                </>
              ) : null}
            </div>
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
        {/* 탭 전환 시 아래서 사르륵 올라오는 등장 */}
        <div key={location.pathname} className="animate-rise">
          <Outlet />
        </div>
      </main>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 border-t border-ink-100 bg-white/95 backdrop-blur z-30">
        <div className="grid grid-cols-3">
          <NavLink
            to="/calendar"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-xs ${
                isActive ? 'text-pretzel' : 'text-ink-400'
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
                isActive ? 'text-pretzel' : 'text-ink-400'
              }`
            }
          >
            <LuUtensils className="text-lg" />
            먹기록
          </NavLink>
          <NavLink
            to="/report"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-xs ${
                isActive ? 'text-pretzel' : 'text-ink-400'
              }`
            }
          >
            <LuMegaphone className="text-lg" />
            보고
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

      {annivOpen ? (
        <AnniversaryManager
          items={anniversaries}
          myPid={effectiveEmpNo}
          resolveName={resolveName}
          onClose={() => setAnnivOpen(false)}
          onChanged={refreshAnniversaries}
        />
      ) : null}

      {/* 접속 시 1회: 오늘의 보고 + 기념일 알림 팝업 */}
      <DailyPopup myId={effectiveEmpNo} />

      {/* 배경에 구름처럼 흘러가는 선 드로잉 빵들 */}
      <FloatingBreads />

      <DevInfo />
    </div>
  );
}
