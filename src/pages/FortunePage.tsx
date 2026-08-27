import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getFortune, type Fortune } from '../lib/fortune';
import { computeMukBTI, computeTasteMatches, type MukBTI } from '../lib/mukbti';
import { ensureSettingsSchema, getSetting, mbtiKey } from '../lib/settings';
import { ensureSchema as ensureLunchesSchema, listLunches, type Lunch } from '../lib/lunches';
import { ensureReviewsSchema, listAllReviews, type LunchReview } from '../lib/reviews';
import { MEMBER_EMPNOS } from '../lib/members';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import { useAnniversaries } from '../contexts/AnniversariesContext';
import Avatar from '../components/Avatar';

// 오늘의 운세 탭: 멤버 전원의 운세를 카드로 보여줌 (내 카드가 맨 위, 강조).
// 운세는 생일+오늘 날짜 시드의 결정적 생성이라 DB 저장 없이 누구에게나 동일하게 보임.
// 각 카드 하단에 먹BTI(먹기록·리뷰 패턴 기반 입맛 유형)도 함께 표시.

export default function FortunePage() {
  const { session } = useAuth();
  const { getProfileByEmpNo, getProfile } = useProfiles();
  const { resolveName, myEmpNo } = useAppData();
  const { items: anniversaries, ready } = useAnniversaries();

  const me = session?.userId ? String(session.userId) : '';
  const myPid = (me ? getProfile(me)?.empNo : '') || myEmpNo || '';
  const today = format(new Date(), 'yyyy-MM-dd');

  // MBTI 뱃지 — 프로필 편집에서 저장한 값 (settings의 mbti.{사번})
  const [mbtiMap, setMbtiMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSettingsSchema();
        const entries = await Promise.all(
          MEMBER_EMPNOS.map(async (emp) => [emp, await getSetting(mbtiKey(emp))] as const),
        );
        if (cancelled) return;
        setMbtiMap(Object.fromEntries(entries.filter(([, v]) => !!v) as [string, string][]));
      } catch {
        /* MBTI 뱃지만 생략 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 먹BTI용 데이터 — 실패하면 먹BTI만 생략
  const [lunches, setLunches] = useState<Lunch[] | null>(null);
  const [reviews, setReviews] = useState<Record<number, LunchReview[]>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([ensureLunchesSchema(), ensureReviewsSchema()]);
        const [rows, revs] = await Promise.all([listLunches(), listAllReviews()]);
        if (cancelled) return;
        setLunches(rows);
        setReviews(revs);
      } catch {
        /* 먹BTI만 생략 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 사번 → 먹BTI (데이터 로드 전엔 undefined로 표시 자체를 생략)
  const mukbtiByEmp = useMemo(() => {
    if (!lunches) return null;
    const map: Record<string, MukBTI> = {};
    for (const emp of MEMBER_EMPNOS) map[emp] = computeMukBTI(emp, lunches, reviews);
    return map;
  }, [lunches, reviews]);

  // 입맛 궁합 — 같은 기록에 남긴 별점 차이 기반 페어 점수 (데이터 로드 전엔 숨김)
  const tasteMatches = useMemo(
    () => (lunches ? computeTasteMatches(MEMBER_EMPNOS, reviews) : null),
    [lunches, reviews],
  );

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

            const mukbti = mukbtiByEmp ? mukbtiByEmp[empNo] : undefined;

            if (!birthday) {
              return (
                <div
                  key={empNo}
                  className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar profile={profile} size="md" fallbackText={name} />
                    <p className="text-xs text-ink-400 break-keep">
                      <span className="font-medium text-ink-600">{name}</span>
                      {mbtiMap[empNo] ? (
                        <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-600 border-violet-100">
                          {mbtiMap[empNo]}
                        </span>
                      ) : null}{' '}
                      — 생일이 등록돼야 운세를 볼 수 있어요. 설정 → 기념일 설정에서 등록해 주세요
                      🎂
                    </p>
                  </div>
                  <MukBTIBlock mukbti={mukbti} />
                </div>
              );
            }

            return (
              <FortuneCard
                key={empNo}
                name={name}
                isMe={isMe}
                fortune={getFortune(empNo, birthday, today, mbtiMap[empNo] ?? '')}
                avatar={<Avatar profile={profile} size="md" fallbackText={name} />}
                mukbti={mukbti}
                mbti={mbtiMap[empNo]}
              />
            );
          })}

          {/* 💞 입맛 궁합 — 같은 기록에 남긴 별점이 얼마나 비슷한지 페어별로 */}
          {tasteMatches && tasteMatches.length > 0 ? (
            <section className="rounded-2xl border border-rose-100 bg-gradient-to-b from-rose-50/60 to-white p-4">
              <h2 className="text-sm font-bold text-ink-900">💞 입맛 궁합</h2>
              <p className="text-[10px] text-ink-400 mt-0.5 break-keep">
                같은 기록에 남긴 별점이 비슷할수록 올라가요
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {tasteMatches.map((m) => (
                  <li
                    key={`${m.a}-${m.b}`}
                    className="flex items-center flex-wrap gap-x-2 gap-y-1 rounded-xl border border-ink-100 bg-white px-3 py-2"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Avatar
                        profile={getProfileByEmpNo(m.a)}
                        size="xs"
                        fallbackText={resolveName(m.a)}
                      />
                      <span className="text-xs font-medium text-ink-800">{resolveName(m.a)}</span>
                    </span>
                    <span className="text-xs">{m.emoji}</span>
                    <span className="inline-flex items-center gap-1">
                      <Avatar
                        profile={getProfileByEmpNo(m.b)}
                        size="xs"
                        fallbackText={resolveName(m.b)}
                      />
                      <span className="text-xs font-medium text-ink-800">{resolveName(m.b)}</span>
                    </span>
                    {m.score != null ? (
                      <span className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-sm font-bold text-rose-500">{m.score}%</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-rose-50 text-rose-600 border-rose-100">
                          {m.label}
                        </span>
                        <span className="text-[10px] text-ink-300">기록 {m.shared}개</span>
                      </span>
                    ) : (
                      <span className="ml-auto text-[10px] text-ink-400 whitespace-nowrap">
                        같이 별점 남긴 기록이 {m.shared}개 — 3개부터 공개돼요 🔍
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
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

// 먹BTI 블록 — 운세 카드/생일 미등록 카드 하단 공용.
// undefined = 데이터 로딩 전(표시 안 함), null = 기록 부족(안내)
function MukBTIBlock({ mukbti }: { mukbti: MukBTI | undefined }) {
  if (mukbti === undefined) return null;
  return (
    <div className="mt-3 pt-3 border-t border-ink-100">
      <p className="text-[10px] font-semibold text-ink-400 mb-1">🧬 먹BTI</p>
      {mukbti ? (
        <>
          <p className="text-sm font-bold text-ink-900 break-keep">
            {mukbti.emoji} {mukbti.title}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-500 break-keep">{mukbti.description}</p>
          {/* 개성 칩 + 최애 가게 — 유형이 같아도 사람별로 갈리는 포인트 */}
          {mukbti.traits.length > 0 || mukbti.favorite ? (
            <div className="mt-1.5 flex items-center flex-wrap gap-1">
              {mukbti.traits.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded-full border bg-ink-50 text-ink-600 border-ink-100 whitespace-nowrap"
                >
                  {t}
                </span>
              ))}
              {mukbti.favorite ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-rose-50 text-rose-600 border-rose-100 max-w-full truncate">
                  ❤️ 최애 {mukbti.favorite.name} ⭐{mukbti.favorite.rating.toFixed(1)}
                  {mukbti.favorite.count > 1 ? ` ×${mukbti.favorite.count}` : ''}
                </span>
              ) : null}
            </div>
          ) : null}
          {/* 평균 별점은 설명 문장에 이미 있어서 여기선 생략 (중복 방지) */}
          <p className="mt-1 text-[10px] text-ink-400 break-keep">
            함께한 기록 {mukbti.stats.participations}회 · 가본 곳 {mukbti.stats.places}곳
          </p>
        </>
      ) : (
        <p className="text-[11px] text-ink-300">기록이 5회 이상 쌓이면 유형이 밝혀져요 🔮</p>
      )}
    </div>
  );
}

function FortuneCard({
  name,
  isMe,
  fortune,
  avatar,
  mukbti,
  mbti,
}: {
  name: string;
  isMe: boolean;
  fortune: Fortune;
  avatar: React.ReactNode;
  mukbti: MukBTI | undefined;
  mbti?: string;
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
            {/* MBTI — 띠·별자리와 같은 "고정 속성" 뱃지 줄에 합류 (프로필 편집에서 설정) */}
            {mbti ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-600 border-violet-100">
                {mbti}
              </span>
            ) : null}
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

      <footer className="mt-2.5 flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
        <span className="whitespace-nowrap">
          🍀 행운의 아이템 <b className="text-ink-700">{fortune.luckyItem}</b>
        </span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          🎨 행운의 색{' '}
          <span
            className={`inline-block w-3 h-3 rounded-full border border-ink-200 ${fortune.luckyColor.className}`}
          />
          <b className="text-ink-700">{fortune.luckyColor.name}</b>
        </span>
      </footer>
      <MukBTIBlock mukbti={mukbti} />
    </article>
  );
}
