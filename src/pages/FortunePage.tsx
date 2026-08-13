import { useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getFortune, type Fortune } from '../lib/fortune';
import { MEMBER_EMPNOS } from '../lib/members';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import { useAnniversaries } from '../contexts/AnniversariesContext';
import Avatar from '../components/Avatar';

// 오늘의 운세 탭: 멤버 전원의 운세를 카드로 보여줌 (내 카드가 맨 위, 강조).
// 운세는 생일+오늘 날짜 시드의 결정적 생성이라 DB 저장 없이 누구에게나 동일하게 보임.

export default function FortunePage() {
  const { session } = useAuth();
  const { getProfileByEmpNo, getProfile } = useProfiles();
  const { resolveName, myEmpNo } = useAppData();
  const { items: anniversaries, ready } = useAnniversaries();

  const me = session?.userId ? String(session.userId) : '';
  const myPid = (me ? getProfile(me)?.empNo : '') || myEmpNo || '';
  const today = format(new Date(), 'yyyy-MM-dd');

  // 사번 → 생일 (anniversaries의 birthday 항목)
  const birthdayByEmpNo = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of anniversaries) {
      if (a.kind === 'birthday' && a.ownerId) map[a.ownerId] = a.date;
    }
    return map;
  }, [anniversaries]);

  // 내 카드 먼저, 나머지는 기본 순서
  const ordered = useMemo(() => {
    const ids = [...MEMBER_EMPNOS] as string[];
    if (myPid && ids.includes(myPid)) {
      return [myPid, ...ids.filter((id) => id !== myPid)];
    }
    return ids;
  }, [myPid]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">🔮 오늘의 운세</h1>
        <p className="text-xs text-ink-400 mt-0.5">
          {format(new Date(), 'M월 d일 (EEE)', { locale: ko })} · 생일 기운으로 점쳐봤어요
        </p>
      </div>

      {!ready ? (
        <div className="text-xs text-ink-400">별자리를 읽는 중... ✨</div>
      ) : (
        <div className="space-y-4">
          {ordered.map((empNo) => {
            const birthday = birthdayByEmpNo[empNo];
            const name = resolveName(empNo);
            const profile = getProfileByEmpNo(empNo);
            const isMe = !!myPid && empNo === myPid;

            if (!birthday) {
              return (
                <div
                  key={empNo}
                  className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-4 flex items-center gap-3"
                >
                  <Avatar profile={profile} size="md" fallbackText={name} />
                  <p className="text-xs text-ink-400">
                    <span className="font-medium text-ink-600">{name}</span> — 생일이 등록돼야
                    운세를 볼 수 있어요. 설정 → 기념일 설정에서 등록해 주세요 🎂
                  </p>
                </div>
              );
            }

            return (
              <FortuneCard
                key={empNo}
                name={name}
                isMe={isMe}
                fortune={getFortune(empNo, birthday, today)}
                avatar={<Avatar profile={profile} size="md" fallbackText={name} />}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ScoreStars({ score }: { score: number }) {
  return (
    <span aria-label={`운세 지수 ${score}점`} title={`운세 지수 ${score}/5`}>
      {'⭐'.repeat(score)}
      <span className="opacity-25">{'⭐'.repeat(5 - score)}</span>
    </span>
  );
}

function FortuneCard({
  name,
  isMe,
  fortune,
  avatar,
}: {
  name: string;
  isMe: boolean;
  fortune: Fortune;
  avatar: React.ReactNode;
}) {
  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 ${
        isMe
          ? 'border-violet-200 bg-gradient-to-b from-violet-50/70 via-white to-white'
          : 'border-ink-100'
      }`}
    >
      <header className="flex items-center gap-3">
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-ink-900">{name}</span>
            {isMe ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                내 운세
              </span>
            ) : null}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-ink-50 text-ink-500 border-ink-100">
              {fortune.zodiac.emoji} {fortune.zodiac.name}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-ink-50 text-ink-500 border-ink-100">
              {fortune.animal.emoji} {fortune.animal.name}
            </span>
          </div>
          <p className="text-xs mt-1">
            <ScoreStars score={fortune.score} />
          </p>
        </div>
      </header>

      <p className="mt-3 text-[15px] font-semibold text-ink-900">{fortune.headline}</p>
      <p className="mt-1 text-[13px] text-ink-600 leading-relaxed">{fortune.overall}</p>

      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
          <p className="text-[11px] font-semibold text-emerald-700 mb-0.5">✅ 오늘 실행해요</p>
          <p className="text-xs text-ink-700 leading-relaxed">{fortune.doToday}</p>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2">
          <p className="text-[11px] font-semibold text-rose-600 mb-0.5">⚠️ 오늘은 조심해요</p>
          <p className="text-xs text-ink-700 leading-relaxed">{fortune.avoidToday}</p>
        </div>
      </div>

      <footer className="mt-2.5 flex items-center gap-3 text-xs text-ink-500">
        <span>
          🍀 행운의 아이템 <b className="text-ink-700">{fortune.luckyItem}</b>
        </span>
        <span className="inline-flex items-center gap-1">
          🎨 행운의 색{' '}
          <span
            className={`inline-block w-3 h-3 rounded-full border border-ink-200 ${fortune.luckyColor.className}`}
          />
          <b className="text-ink-700">{fortune.luckyColor.name}</b>
        </span>
      </footer>
    </article>
  );
}
