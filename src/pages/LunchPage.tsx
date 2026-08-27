import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  LuPlus,
  LuTrash2,
  LuX,
  LuCheck,
  LuPencil,
  LuExternalLink,
  LuChevronDown,
  LuChevronRight,
  LuStar,
} from 'react-icons/lu';
import StarRating from '../components/StarRating';
import {
  createLunch,
  deleteLunch,
  ensureSchema,
  listLunches,
  promoteLunch,
  updateLunch,
  type Lunch,
  type LunchStatus,
  type MealType,
} from '../lib/lunches';
import {
  averageRating,
  deleteReview,
  ensureReviewsSchema,
  listAllReviews,
  upsertReview,
  type LunchReview,
} from '../lib/reviews';
import {
  ALL_PARTICIPANT_IDS,
  MEMBER_EMPNOS,
  isValidParticipantId,
  type ParticipantId,
} from '../lib/members';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import Avatar from '../components/Avatar';
import LunchAwards, { normalizeRestaurant } from '../components/LunchAwards';

const MEAL_LABEL: Record<MealType, string> = {
  lunch: '쪼물런치',
  dinner: '쪼물디너',
};

type AddFormRequest = { kind: 'add'; status: LunchStatus; meal: MealType };
type EditFormRequest = { kind: 'edit'; lunch: Lunch };
type PromoteFormRequest = { kind: 'promote'; lunch: Lunch };
type FormRequest = AddFormRequest | EditFormRequest | PromoteFormRequest | null;

export default function LunchPage() {
  const { session } = useAuth();
  const { getProfileByEmpNo, getProfile } = useProfiles();
  const { resolveName, myEmpNo } = useAppData();
  const me = session?.userId ? String(session.userId) : '';
  // 내 참여자 ID(사번): 프로필에 저장된 값 우선, 없으면 자동 감지값
  const myPid = (me ? getProfile(me)?.empNo : '') || myEmpNo || '';
  const [lunches, setLunches] = useState<Lunch[]>([]);
  const [reviews, setReviews] = useState<Record<number, LunchReview[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormRequest>(null);
  const [reviewTarget, setReviewTarget] = useState<Lunch | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      await ensureSchema();
      await ensureReviewsSchema();
      const [rows, revs] = await Promise.all([listLunches(), listAllReviews()]);
      setLunches(rows);
      setReviews(revs);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const memberName = useMemo(() => (id: string) => resolveName(id), [resolveName]);

  // 가고싶은 정렬: 날짜 정해진 건 런치/디너 무관하게 가까운 날짜순으로 맨 위,
  // 날짜 없는 건 런치 먼저 → 디너, 각 그룹 안에선 최신순
  const wishlist = useMemo(() => {
    const mealRank = (l: Lunch) => (l.meal === 'lunch' ? 0 : 1);
    return lunches
      .filter((l) => l.status === 'wishlist')
      .sort((a, b) => {
        if (!!a.plannedDate !== !!b.plannedDate) return a.plannedDate ? -1 : 1;
        if (a.plannedDate && b.plannedDate) {
          if (a.plannedDate !== b.plannedDate) return a.plannedDate.localeCompare(b.plannedDate);
          return b.id - a.id;
        }
        if (mealRank(a) !== mealRank(b)) return mealRank(a) - mealRank(b);
        return b.id - a.id;
      });
  }, [lunches]);
  const lunchDone = useMemo(
    () => lunches.filter((l) => l.status === 'done' && l.meal === 'lunch'),
    [lunches],
  );
  const dinnerDone = useMemo(
    () => lunches.filter((l) => l.status === 'done' && l.meal === 'dinner'),
    [lunches],
  );

  // 단골 뱃지: 같은 가게(공백·대소문자 무시)를 2번 이상 갔으면 2회차부터 방문 회차를 붙인다.
  // lunchId → n회차. 다녀온(done) 기록만 세고, 회차는 다녀온 날짜순.
  const visitOrdinals = useMemo(() => {
    const byPlace: Record<string, Lunch[]> = {};
    for (const l of lunches) {
      if (l.status !== 'done') continue;
      const key = normalizeRestaurant(l.restaurant);
      if (!key) continue;
      (byPlace[key] ??= []).push(l);
    }
    const map: Record<number, number> = {};
    for (const group of Object.values(byPlace)) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) =>
        a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date),
      );
      sorted.forEach((l, i) => {
        if (i >= 1) map[l.id] = i + 1;
      });
    }
    return map;
  }, [lunches]);

  async function handleCreate(input: Parameters<typeof createLunch>[0]) {
    await createLunch(input);
    setForm(null);
    await refresh();
  }

  async function handleUpdate(input: Parameters<typeof updateLunch>[0]) {
    await updateLunch(input);
    setForm(null);
    await refresh();
  }

  // 다녀왔어요: 기록을 done으로 바꾸고, 별점/한줄평은 "누른 사람 본인"의 평으로 저장.
  // (예전엔 lunches.comment에 저장했다가 이관 로직이 다른 사람 평으로 옮기는 버그가 있었음)
  async function handlePromote(input: {
    id: number;
    date: string;
    rating: number;
    comment: string;
    participants: ParticipantId[];
  }) {
    await promoteLunch({
      id: input.id,
      date: input.date,
      participants: input.participants,
    });
    if (isValidParticipantId(myPid)) {
      await upsertReview({
        lunchId: input.id,
        reviewerId: myPid,
        rating: input.rating,
        comment: input.comment,
      });
    }
    setForm(null);
    await refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm('이 기록을 삭제할까요?')) return;
    try {
      await deleteLunch(id);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패');
    }
  }

  // 내 평 저장 (있으면 덮어씀)
  async function handleReviewSave(input: { lunchId: number; rating: number; comment: string }) {
    if (!isValidParticipantId(myPid)) return;
    await upsertReview({ ...input, reviewerId: myPid });
    setReviewTarget(null);
    await refresh();
  }

  // 내 평 삭제
  async function handleReviewDelete(lunchId: number) {
    if (!myPid) return;
    await deleteReview(lunchId, myPid);
    setReviewTarget(null);
    await refresh();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">먹기록</h1>
        <p className="text-xs text-ink-400 mt-0.5">
          {lunches.length > 0 ? `총 ${lunches.length}건` : '아직 기록 없음'}
        </p>
      </div>

      {error ? (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      ) : null}

      {loading && lunches.length === 0 ? (
        <div className="text-xs text-ink-400">불러오는 중...</div>
      ) : (
        <div className="space-y-8">
          <LunchAwards lunches={lunches} reviews={reviews} memberName={memberName} />

          <WishlistSection
            records={wishlist}
            onAdd={(meal) => setForm({ kind: 'add', status: 'wishlist', meal })}
            onPromote={(lunch) => setForm({ kind: 'promote', lunch })}
            onEdit={(lunch) => setForm({ kind: 'edit', lunch })}
            onDelete={handleDelete}
            memberName={memberName}
            getProfile={getProfileByEmpNo}
          />

          <DoneSection
            title={`🍜 ${MEAL_LABEL.lunch}`}
            collapseKey="zzomul.done.lunch.collapsed.v1"
            records={lunchDone}
            visitOrdinals={visitOrdinals}
            reviews={reviews}
            myPid={myPid}
            onAdd={() => setForm({ kind: 'add', status: 'done', meal: 'lunch' })}
            onEdit={(lunch) => setForm({ kind: 'edit', lunch })}
            onDelete={handleDelete}
            onReview={(lunch) => setReviewTarget(lunch)}
            memberName={memberName}
            getProfile={getProfileByEmpNo}
          />

          <DoneSection
            title={`🌙 ${MEAL_LABEL.dinner}`}
            collapseKey="zzomul.done.dinner.collapsed.v1"
            records={dinnerDone}
            visitOrdinals={visitOrdinals}
            reviews={reviews}
            myPid={myPid}
            onAdd={() => setForm({ kind: 'add', status: 'done', meal: 'dinner' })}
            onEdit={(lunch) => setForm({ kind: 'edit', lunch })}
            onDelete={handleDelete}
            onReview={(lunch) => setReviewTarget(lunch)}
            memberName={memberName}
            getProfile={getProfileByEmpNo}
          />
        </div>
      )}

      {form?.kind === 'add' ? (
        <RecordForm
          mode={{ type: 'add', status: form.status, meal: form.meal }}
          createdBy={me ?? ''}
          memberName={memberName}
          onClose={() => setForm(null)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      ) : null}

      {form?.kind === 'edit' ? (
        <RecordForm
          mode={{ type: 'edit', lunch: form.lunch }}
          createdBy={me ?? ''}
          memberName={memberName}
          onClose={() => setForm(null)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      ) : null}

      {form?.kind === 'promote' ? (
        <PromoteFormDialog
          lunch={form.lunch}
          memberName={memberName}
          onClose={() => setForm(null)}
          onSubmit={handlePromote}
        />
      ) : null}

      {reviewTarget ? (
        <ReviewFormDialog
          lunch={reviewTarget}
          existing={(reviews[reviewTarget.id] ?? []).find((r) => r.reviewerId === myPid) ?? null}
          onClose={() => setReviewTarget(null)}
          onSubmit={handleReviewSave}
          onDelete={handleReviewDelete}
        />
      ) : null}
    </div>
  );
}

const WISHLIST_COLLAPSE_KEY = 'zzomul.wishlist.collapsed.v1';

function WishlistSection({
  records,
  onAdd,
  onPromote,
  onEdit,
  onDelete,
  memberName,
  getProfile,
}: {
  records: Lunch[];
  onAdd: (meal: MealType) => void;
  onPromote: (lunch: Lunch) => void;
  onEdit: (lunch: Lunch) => void;
  onDelete: (id: number) => void;
  memberName: (id: string) => string;
  getProfile: (id: string) => import('../lib/profiles').Profile | null;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WISHLIST_COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(WISHLIST_COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
  }

  return (
    <section>
      <header className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={toggle}
          className="flex items-baseline gap-2 hover:opacity-70 transition-opacity"
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <LuChevronRight className="text-ink-400 self-center" />
          ) : (
            <LuChevronDown className="text-ink-400 self-center" />
          )}
          <h2 className="text-base font-semibold tracking-tight">🌟 가고싶은</h2>
          <span className="text-xs text-ink-400">{records.length}건</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAdd('lunch')}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-full border border-ink-200 bg-white text-ink-700 text-[11px] font-medium hover:border-pretzel/40 hover:text-pretzel"
          >
            <LuPlus className="text-xs" />
            런치
          </button>
          <button
            type="button"
            onClick={() => onAdd('dinner')}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-full border border-ink-200 bg-white text-ink-700 text-[11px] font-medium hover:border-pretzel/40 hover:text-pretzel"
          >
            <LuPlus className="text-xs" />
            디너
          </button>
        </div>
      </header>

      {collapsed ? null : records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-pretzel/30 bg-white/50 py-8 px-6 text-center">
          <p className="text-xs text-ink-400">아직 없어요. 가보고 싶은 곳을 추가해 보세요 🍽️</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {records.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card hover:border-pretzel/40 hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* 좁은 화면에선 칩이 잘리지 않고 통째로 다음 줄로 내려가게 */}
                  <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1 mb-1.5">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
                        item.meal === 'lunch'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : 'bg-accent-soft text-accent border-accent/20'
                      }`}
                    >
                      {MEAL_LABEL[item.meal]}
                    </span>
                    {item.delivery ? <DeliveryChip /> : null}
                    {item.plannedDate ? (
                      <span className="text-[11px] text-ink-500 whitespace-nowrap">
                        예정 · {format(new Date(item.plannedDate), 'M월 d일 (EEE)', { locale: ko })}
                      </span>
                    ) : null}
                  </div>
                  <RestaurantTitle name={item.restaurant} link={item.link} />
                  {item.menu ? (
                    <p className="text-sm text-ink-600 mt-0.5 whitespace-pre-wrap">{item.menu}</p>
                  ) : null}
                  <div className="border-t border-ink-100 my-3" />
                  {item.participants.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {item.participants.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-ink-50 text-[11px] text-ink-600 border border-ink-100"
                        >
                          <Avatar profile={getProfile(id)} size="xs" fallbackText={memberName(id)} />
                          {memberName(id)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <CreatorLine
                    createdBy={item.createdBy}
                    memberName={memberName}
                    getProfile={getProfile}
                  />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPromote(item)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-ink-900 text-white text-[11px] font-medium hover:bg-pretzel"
                    title="다녀왔어요"
                  >
                    <LuCheck className="text-xs" />
                    다녀왔어요
                  </button>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="text-ink-300 hover:text-ink-900 p-1.5 rounded hover:bg-ink-50"
                      aria-label="수정"
                      title="수정"
                    >
                      <LuPencil className="text-sm" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="text-ink-300 hover:text-red-600 p-1.5 rounded hover:bg-red-50"
                      aria-label="삭제"
                      title="삭제"
                    >
                      <LuTrash2 className="text-sm" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DoneSection({
  title,
  collapseKey,
  records,
  visitOrdinals,
  reviews,
  myPid,
  onAdd,
  onEdit,
  onDelete,
  onReview,
  memberName,
  getProfile,
}: {
  title: string;
  collapseKey: string;
  records: Lunch[];
  visitOrdinals: Record<number, number>; // lunchId → 단골 n회차 (2회차부터)
  reviews: Record<number, LunchReview[]>;
  myPid: string;
  onAdd: () => void;
  onEdit: (lunch: Lunch) => void;
  onDelete: (id: number) => void;
  onReview: (lunch: Lunch) => void;
  memberName: (empNo: string) => string;
  getProfile: (id: string) => import('../lib/profiles').Profile | null;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(collapseKey) === '1';
    } catch {
      return false;
    }
  });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(collapseKey, next ? '1' : '0');
    } catch {
      // ignore
    }
  }

  return (
    <section>
      <header className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={toggle}
          className="flex items-baseline gap-2 hover:opacity-70 transition-opacity"
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <LuChevronRight className="text-ink-400 self-center" />
          ) : (
            <LuChevronDown className="text-ink-400 self-center" />
          )}
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <span className="text-xs text-ink-400">{records.length}건</span>
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-ink-900 text-white text-[11px] font-medium hover:bg-pretzel"
        >
          <LuPlus className="text-xs" />
          추가
        </button>
      </header>

      {collapsed ? null : records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-pretzel/30 bg-white/50 py-8 px-6 text-center">
          <p className="text-xs text-ink-400">아직 기록이 없어요 🥄</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {records.map((lunch) => {
            const revs = reviews[lunch.id] ?? [];
            const avg = averageRating(revs);
            const myReview = myPid ? revs.find((r) => r.reviewerId === myPid) ?? null : null;
            // 참여자만 평을 남길 수 있음 (참여자 목록이 비어 있으면 누구나 가능)
            const canReview =
              !!myPid && (lunch.participants.length === 0 || lunch.participants.includes(myPid as ParticipantId));
            return (
              <li
                key={lunch.id}
                className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card hover:border-pretzel/40 hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* 좁은 화면에선 칩이 잘리지 않고 통째로 다음 줄로 내려가게 */}
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1">
                      <span className="text-[11px] text-ink-400 font-medium whitespace-nowrap">
                        {format(new Date(lunch.date), 'M월 d일 (EEE)', { locale: ko })}
                      </span>
                      {lunch.delivery ? <DeliveryChip /> : null}
                      {visitOrdinals[lunch.id] ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-100 whitespace-nowrap">
                          🔥 단골 {visitOrdinals[lunch.id]}회차
                        </span>
                      ) : null}
                      {/* 리뷰가 있으면 평균, 없으면 기존 단일 별점 */}
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <StarRating value={avg ?? lunch.rating} size="sm" readOnly />
                        {avg != null ? (
                          <span className="text-[11px] text-ink-500 font-medium">
                            평균 {avg.toFixed(1)} · 평 {revs.length}개
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <RestaurantTitle name={lunch.restaurant} link={lunch.link} />
                    {lunch.menu ? (
                      <p className="text-sm text-ink-600 mt-0.5 whitespace-pre-wrap">{lunch.menu}</p>
                    ) : null}
                    <div className="border-t border-ink-100 my-3" />
                    {revs.length > 0 ? (
                      <ul className="mt-3 space-y-1.5">
                        {revs.map((r) => (
                          <li
                            key={r.reviewerId}
                            className="flex items-start gap-2 rounded-md bg-ink-50/60 border border-ink-100 px-2.5 py-2"
                          >
                            <Avatar
                              profile={getProfile(r.reviewerId)}
                              size="xs"
                              fallbackText={memberName(r.reviewerId)}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-medium text-ink-700">
                                  {memberName(r.reviewerId)}
                                </span>
                                <StarRating value={r.rating} size="sm" readOnly />
                              </div>
                              {r.comment ? (
                                <p className="text-xs text-ink-600 mt-0.5 whitespace-pre-wrap">
                                  {r.comment}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {canReview ? (
                      <button
                        type="button"
                        onClick={() => onReview(lunch)}
                        className="mt-3 inline-flex items-center gap-1 h-7 px-3 rounded-full border border-amber-200 bg-amber-50/60 text-amber-700 text-[11px] font-medium hover:bg-amber-100"
                      >
                        <LuStar className="text-xs" />
                        {myReview ? '내 평 수정' : '평 남기기'}
                      </button>
                    ) : null}
                    {lunch.participants.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {lunch.participants.map((id) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-ink-50 text-[11px] text-ink-600 border border-ink-100"
                          >
                            <Avatar profile={getProfile(id)} size="xs" fallbackText={memberName(id)} />
                            {memberName(id)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <CreatorLine
                      createdBy={lunch.createdBy}
                      memberName={memberName}
                      getProfile={getProfile}
                    />
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onEdit(lunch)}
                      className="text-ink-300 hover:text-ink-900 p-1.5 rounded hover:bg-ink-50"
                      aria-label="수정"
                      title="수정"
                    >
                      <LuPencil className="text-sm" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(lunch.id)}
                      className="text-ink-300 hover:text-red-600 p-1.5 rounded hover:bg-red-50"
                      aria-label="삭제"
                      title="삭제"
                    >
                      <LuTrash2 className="text-sm" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// -----------------
// Review form (participant rating + comment)
// -----------------

function ReviewFormDialog({
  lunch,
  existing,
  onClose,
  onSubmit,
  onDelete,
}: {
  lunch: Lunch;
  existing: LunchReview | null;
  onClose: () => void;
  onSubmit: (data: { lunchId: number; rating: number; comment: string }) => Promise<void>;
  onDelete: (lunchId: number) => Promise<void>;
}) {
  const [rating, setRating] = useState(existing ? existing.rating : 4);
  const [comment, setComment] = useState(existing ? existing.comment : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({ lunchId: lunch.id, rating, comment: comment.trim() });
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    if (!confirm('내 평을 삭제할까요?')) return;
    setBusy(true);
    setErr(null);
    try {
      await onDelete(lunch.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '삭제 실패');
      setBusy(false);
    }
  }

  return (
    <ModalShell title={existing ? '내 평 수정' : '평 남기기'} onClose={onClose}>
      <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/40">
        <p className="text-[11px] text-ink-500">
          {MEAL_LABEL[lunch.meal]} ·{' '}
          <span className="font-medium text-ink-700">{lunch.restaurant}</span>
        </p>
        {lunch.menu ? <p className="text-[11px] text-ink-400 mt-0.5">{lunch.menu}</p> : null}
      </div>

      <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto overflow-x-hidden">
        <Field label="내 별점">
          <StarRating value={rating} onChange={setRating} size="lg" />
        </Field>

        <Field label="소감">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="어땠는지 솔직하게 남겨주세요."
            className="w-full px-3 py-2 rounded-md border border-ink-200 text-sm placeholder-ink-300 resize-none"
          />
        </Field>

        {existing ? (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-[11px] text-red-500 hover:text-red-700 hover:underline underline-offset-2 disabled:opacity-60"
          >
            내 평 삭제
          </button>
        ) : null}

        {err ? (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {err}
          </div>
        ) : null}
      </form>

      <ModalFooter busy={busy} onClose={onClose} onSubmit={submit} />
    </ModalShell>
  );
}

function CreatorLine({
  createdBy,
  memberName,
  getProfile,
}: {
  createdBy: string;
  memberName: (id: string) => string;
  getProfile: (id: string) => import('../lib/profiles').Profile | null;
}) {
  if (!createdBy) return null;
  const name = memberName(createdBy);
  // 알 수 없는 작성자(예: 예전 버전 로그로 저장된 이메일 등)는 표시하지 않음
  if (!name || name === createdBy) return null;
  return (
    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-400">
      <span>작성자</span>
      <Avatar profile={getProfile(createdBy)} size="xs" fallbackText={name} />
      <span className="text-ink-500 font-medium">{name}</span>
    </div>
  );
}

// 배달 기록 표시 칩 (텍스트로 "(배달)" 적는 대신 체크로 구분)
function DeliveryChip() {
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-100 whitespace-nowrap">
      🛵 배달
    </span>
  );
}

function RestaurantTitle({ name, link }: { name: string; link: string }) {
  if (link && /^https?:\/\//i.test(link)) {
    return (
      <h3 className="text-base font-semibold text-ink-900 leading-snug break-keep">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-accent hover:underline underline-offset-2 decoration-1"
        >
          {name}
          <LuExternalLink className="text-xs text-ink-400" />
        </a>
      </h3>
    );
  }
  return <h3 className="text-base font-semibold text-ink-900 leading-snug break-keep">{name}</h3>;
}

// -----------------
// Record form (add + edit for both wishlist and done)
// -----------------

type RecordFormMode =
  | { type: 'add'; status: LunchStatus; meal: MealType }
  | { type: 'edit'; lunch: Lunch };

function RecordForm({
  mode,
  createdBy,
  memberName,
  onClose,
  onCreate,
  onUpdate,
}: {
  mode: RecordFormMode;
  createdBy: string;
  memberName: (id: string) => string;
  onClose: () => void;
  onCreate: (data: {
    date: string;
    meal: MealType;
    status: LunchStatus;
    restaurant: string;
    menu: string;
    rating: number;
    link: string;
    plannedDate: string | null;
    delivery: boolean;
    participants: ParticipantId[];
    createdBy: string;
  }) => Promise<void>;
  onUpdate: (data: {
    id: number;
    date: string;
    meal: MealType;
    restaurant: string;
    menu: string;
    rating: number;
    link: string;
    plannedDate: string | null;
    delivery: boolean;
    participants: ParticipantId[];
  }) => Promise<void>;
}) {
  const isEdit = mode.type === 'edit';
  const status: LunchStatus = isEdit ? mode.lunch.status : mode.status;
  const isWishlist = status === 'wishlist';

  const [meal, setMeal] = useState<MealType>(isEdit ? mode.lunch.meal : mode.meal);
  const [date, setDate] = useState(() =>
    isEdit ? mode.lunch.date : format(new Date(), 'yyyy-MM-dd'),
  );
  const [plannedDate, setPlannedDate] = useState<string>(
    isEdit ? mode.lunch.plannedDate ?? '' : '',
  );
  const [restaurant, setRestaurant] = useState(isEdit ? mode.lunch.restaurant : '');
  const [menu, setMenu] = useState(isEdit ? mode.lunch.menu : '');
  const [link, setLink] = useState(isEdit ? mode.lunch.link : '');
  const [delivery, setDelivery] = useState(isEdit ? mode.lunch.delivery : false);
  const [participants, setParticipants] = useState<ParticipantId[]>(
    isEdit && mode.lunch.participants.length > 0
      ? [...mode.lunch.participants]
      : [...MEMBER_EMPNOS],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: ParticipantId) {
    setParticipants((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!restaurant.trim()) {
      setErr('식당명을 입력해 주세요.');
      return;
    }
    if (link.trim() && !/^https?:\/\//i.test(link.trim())) {
      setErr('링크는 http:// 또는 https:// 로 시작해야 해요.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const finalDate = isWishlist ? plannedDate || format(new Date(), 'yyyy-MM-dd') : date;
      const payload = {
        date: finalDate,
        meal,
        restaurant: restaurant.trim(),
        menu: menu.trim(),
        rating: isEdit ? mode.lunch.rating : 0,
        link: link.trim(),
        plannedDate: isWishlist ? plannedDate || null : null,
        delivery,
        participants,
      };
      if (isEdit) {
        await onUpdate({ id: mode.lunch.id, ...payload });
      } else {
        await onCreate({ ...payload, status, createdBy });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
      setBusy(false);
    }
  }

  const title = isEdit
    ? isWishlist
      ? '가고싶은 식당 수정'
      : `${MEAL_LABEL[meal]} 기록 수정`
    : isWishlist
      ? '가고싶은 식당 추가'
      : `${MEAL_LABEL[meal]} 기록 추가`;

  return (
    <ModalShell title={title} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto overflow-x-hidden">
        <Field label="분류">
          <div className="grid grid-cols-2 gap-2">
            {(['lunch', 'dinner'] as MealType[]).map((key) => {
              const active = meal === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMeal(key)}
                  className={`h-10 px-2 rounded-md border text-xs font-medium transition-colors ${
                    active
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
                  }`}
                >
                  {MEAL_LABEL[key]}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="어떻게 먹나요?">
          <div className="grid grid-cols-2 gap-2">
            {([false, true] as const).map((isDelivery) => {
              const active = delivery === isDelivery;
              return (
                <button
                  key={String(isDelivery)}
                  type="button"
                  onClick={() => setDelivery(isDelivery)}
                  className={`h-10 px-2 rounded-md border text-xs font-medium transition-colors ${
                    active
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
                  }`}
                >
                  {isDelivery ? '🛵 배달로 먹어요' : '🍽️ 가서 먹어요'}
                </button>
              );
            })}
          </div>
        </Field>

        {isWishlist ? (
          <Field label="예정 날짜 (선택)">
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-ink-200 text-sm"
            />
          </Field>
        ) : (
          <Field label="날짜">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-ink-200 text-sm"
            />
          </Field>
        )}

        <Field label="식당">
          <input
            type="text"
            required
            value={restaurant}
            onChange={(e) => setRestaurant(e.target.value)}
            placeholder="예: 청년다방"
            className="w-full h-10 px-3 rounded-md border border-ink-200 text-sm placeholder-ink-300"
          />
        </Field>

        <Field label={isWishlist ? '메뉴/노트 (선택)' : '메뉴'}>
          <textarea
            value={menu}
            onChange={(e) => setMenu(e.target.value)}
            placeholder={isWishlist ? '예: 파스타 유명한 곳\n여러 줄도 가능해요' : '예: 로제 떡볶이'}
            rows={isWishlist ? 3 : 2}
            className="w-full px-3 py-2 rounded-md border border-ink-200 text-sm placeholder-ink-300 resize-none"
          />
        </Field>

        <Field label="링크 (선택)">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://naver.me/... 지도/블로그 링크"
            className="w-full h-10 px-3 rounded-md border border-ink-200 text-sm placeholder-ink-300"
          />
        </Field>

        <Field label={isWishlist ? '함께 갈 사람' : '함께한 사람'}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ALL_PARTICIPANT_IDS.map((id) => {
              const active = participants.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className={`h-10 px-2 rounded-md border text-xs font-medium transition-colors ${
                    active
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
                  }`}
                >
                  {memberName(id)}
                </button>
              );
            })}
          </div>
        </Field>

        {err ? (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {err}
          </div>
        ) : null}
      </form>

      <ModalFooter busy={busy} onClose={onClose} onSubmit={submit} />
    </ModalShell>
  );
}

// -----------------
// Promote form (wishlist → done)
// -----------------

function PromoteFormDialog({
  lunch,
  memberName,
  onClose,
  onSubmit,
}: {
  lunch: Lunch;
  memberName: (id: string) => string;
  onClose: () => void;
  onSubmit: (data: {
    id: number;
    date: string;
    rating: number;
    comment: string;
    participants: ParticipantId[];
  }) => Promise<void>;
}) {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState('');
  const [participants, setParticipants] = useState<ParticipantId[]>(
    lunch.participants.length > 0 ? [...lunch.participants] : [...MEMBER_EMPNOS],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: ParticipantId) {
    setParticipants((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        id: lunch.id,
        date,
        rating,
        comment: comment.trim(),
        participants,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
      setBusy(false);
    }
  }

  return (
    <ModalShell title="다녀왔어요" onClose={onClose}>
      <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/40">
        <p className="text-[11px] text-ink-500">
          {MEAL_LABEL[lunch.meal]} · <span className="font-medium text-ink-700">{lunch.restaurant}</span>
        </p>
        {lunch.menu ? <p className="text-[11px] text-ink-400 mt-0.5">{lunch.menu}</p> : null}
      </div>

      <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto overflow-x-hidden">
        <Field label="다녀온 날짜">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-ink-200 text-sm"
          />
        </Field>

        <Field label="내 별점">
          <StarRating value={rating} onChange={setRating} size="lg" />
        </Field>

        <Field label="내 한줄평">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="어땠는지 짧게 남겨주세요. 내 이름의 평으로 저장돼요 ✍️"
            className="w-full px-3 py-2 rounded-md border border-ink-200 text-sm placeholder-ink-300 resize-none"
          />
        </Field>

        <Field label="함께한 사람">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ALL_PARTICIPANT_IDS.map((id) => {
              const active = participants.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className={`h-10 px-2 rounded-md border text-xs font-medium transition-colors ${
                    active
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
                  }`}
                >
                  {memberName(id)}
                </button>
              );
            })}
          </div>
        </Field>

        {err ? (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {err}
          </div>
        ) : null}
      </form>

      <ModalFooter busy={busy} onClose={onClose} onSubmit={submit} submitLabel="완료" />
    </ModalShell>
  );
}

// -----------------
// Modal shell (shared)
// -----------------

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg border border-ink-100 max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 p-1 rounded"
            aria-label="닫기"
          >
            <LuX />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({
  busy,
  onClose,
  onSubmit,
  submitLabel = '저장',
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  submitLabel?: string;
}) {
  return (
    <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-ink-100 bg-white">
      <button
        type="button"
        onClick={onClose}
        className="h-10 px-4 text-sm rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-50"
      >
        취소
      </button>
      <button
        type="submit"
        onClick={onSubmit}
        disabled={busy}
        className="h-10 px-5 text-sm rounded-full bg-ink-900 text-white hover:bg-pretzel disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? '저장 중...' : submitLabel}
      </button>
    </footer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-500 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
