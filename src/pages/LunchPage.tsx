import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LuPlus, LuTrash2, LuX, LuCheck, LuPencil, LuExternalLink } from 'react-icons/lu';
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
  ALL_PARTICIPANT_IDS,
  MEMBER_EMPNOS,
  type ParticipantId,
} from '../lib/members';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import Avatar from '../components/Avatar';

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
  const { getProfileByEmpNo } = useProfiles();
  const { resolveName } = useAppData();
  const me = session?.userId ? String(session.userId) : '';
  const [lunches, setLunches] = useState<Lunch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormRequest>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      await ensureSchema();
      const rows = await listLunches();
      setLunches(rows);
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

  const wishlist = useMemo(
    () => lunches.filter((l) => l.status === 'wishlist').sort((a, b) => b.id - a.id),
    [lunches],
  );
  const lunchDone = useMemo(
    () => lunches.filter((l) => l.status === 'done' && l.meal === 'lunch'),
    [lunches],
  );
  const dinnerDone = useMemo(
    () => lunches.filter((l) => l.status === 'done' && l.meal === 'dinner'),
    [lunches],
  );

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

  async function handlePromote(input: Parameters<typeof promoteLunch>[0]) {
    await promoteLunch(input);
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
            title={MEAL_LABEL.lunch}
            records={lunchDone}
            onAdd={() => setForm({ kind: 'add', status: 'done', meal: 'lunch' })}
            onEdit={(lunch) => setForm({ kind: 'edit', lunch })}
            onDelete={handleDelete}
            memberName={memberName}
            getProfile={getProfileByEmpNo}
          />

          <DoneSection
            title={MEAL_LABEL.dinner}
            records={dinnerDone}
            onAdd={() => setForm({ kind: 'add', status: 'done', meal: 'dinner' })}
            onEdit={(lunch) => setForm({ kind: 'edit', lunch })}
            onDelete={handleDelete}
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
    </div>
  );
}

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
  return (
    <section>
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold tracking-tight">가고싶은</h2>
          <span className="text-xs text-ink-400">{records.length}건</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAdd('lunch')}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-ink-200 text-ink-700 text-[11px] font-medium hover:bg-ink-50"
          >
            <LuPlus className="text-xs" />
            런치
          </button>
          <button
            type="button"
            onClick={() => onAdd('dinner')}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-ink-200 text-ink-700 text-[11px] font-medium hover:bg-ink-50"
          >
            <LuPlus className="text-xs" />
            디너
          </button>
        </div>
      </header>

      {records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-200 py-8 px-6 text-center">
          <p className="text-xs text-ink-400">아직 없어요. 가보고 싶은 곳을 추가해 보세요.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {records.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-ink-100 bg-white p-4 hover:border-ink-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                        item.meal === 'lunch'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : 'bg-accent-soft text-accent border-accent/20'
                      }`}
                    >
                      {MEAL_LABEL[item.meal]}
                    </span>
                    {item.plannedDate ? (
                      <span className="text-[11px] text-ink-500">
                        예정 · {format(new Date(item.plannedDate), 'M월 d일 (EEE)', { locale: ko })}
                      </span>
                    ) : null}
                  </div>
                  <RestaurantTitle name={item.restaurant} link={item.link} />
                  {item.menu ? (
                    <p className="text-sm text-ink-600 mt-0.5">{item.menu}</p>
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
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-ink-900 text-white text-[11px] font-medium hover:bg-ink-700"
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
  records,
  onAdd,
  onEdit,
  onDelete,
  memberName,
  getProfile,
}: {
  title: string;
  records: Lunch[];
  onAdd: () => void;
  onEdit: (lunch: Lunch) => void;
  onDelete: (id: number) => void;
  memberName: (empNo: string) => string;
  getProfile: (id: string) => import('../lib/profiles').Profile | null;
}) {
  return (
    <section>
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <span className="text-xs text-ink-400">{records.length}건</span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-ink-900 text-white text-[11px] font-medium hover:bg-ink-700"
        >
          <LuPlus className="text-xs" />
          추가
        </button>
      </header>

      {records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-200 py-8 px-6 text-center">
          <p className="text-xs text-ink-400">기록 없음</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {records.map((lunch) => (
            <li
              key={lunch.id}
              className="rounded-lg border border-ink-100 bg-white p-4 hover:border-ink-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] text-ink-400 font-medium">
                      {format(new Date(lunch.date), 'M월 d일 (EEE)', { locale: ko })}
                    </span>
                    <StarRating value={lunch.rating} size="sm" readOnly />
                  </div>
                  <RestaurantTitle name={lunch.restaurant} link={lunch.link} />
                  {lunch.menu ? (
                    <p className="text-sm text-ink-600 mt-0.5">{lunch.menu}</p>
                  ) : null}
                  <div className="border-t border-ink-100 my-3" />
                  {lunch.comment ? (
                    <p className="text-sm text-ink-500 whitespace-pre-wrap">
                      {lunch.comment}
                    </p>
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
          ))}
        </ul>
      )}
    </section>
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

function RestaurantTitle({ name, link }: { name: string; link: string }) {
  if (link && /^https?:\/\//i.test(link)) {
    return (
      <h3 className="text-base font-semibold text-ink-900 leading-snug">
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
  return <h3 className="text-base font-semibold text-ink-900 leading-snug">{name}</h3>;
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
    comment: string;
    link: string;
    plannedDate: string | null;
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
    comment: string;
    link: string;
    plannedDate: string | null;
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
  const [rating, setRating] = useState(isEdit ? mode.lunch.rating || 4 : 4);
  const [comment, setComment] = useState(isEdit ? mode.lunch.comment : '');
  const [link, setLink] = useState(isEdit ? mode.lunch.link : '');
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
        rating: isWishlist ? 0 : rating,
        comment: isWishlist ? '' : comment.trim(),
        link: link.trim(),
        plannedDate: isWishlist ? plannedDate || null : null,
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
      <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto">
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
          <input
            type="text"
            value={menu}
            onChange={(e) => setMenu(e.target.value)}
            placeholder={isWishlist ? '예: 파스타 유명한 곳' : '예: 로제 떡볶이'}
            className="w-full h-10 px-3 rounded-md border border-ink-200 text-sm placeholder-ink-300"
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

        {!isWishlist ? (
          <>
            <Field label="별점">
              <StarRating value={rating} onChange={setRating} size="lg" />
            </Field>

            <Field label="한줄평">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="어땠는지 짧게 남겨주세요."
                className="w-full px-3 py-2 rounded-md border border-ink-200 text-sm placeholder-ink-300 resize-none"
              />
            </Field>
          </>
        ) : null}

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

      <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto">
        <Field label="다녀온 날짜">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-ink-200 text-sm"
          />
        </Field>

        <Field label="별점">
          <StarRating value={rating} onChange={setRating} size="lg" />
        </Field>

        <Field label="한줄평">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="어땠는지 짧게 남겨주세요."
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
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg border border-ink-100 max-h-[90vh] flex flex-col"
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
        className="h-10 px-4 text-sm rounded-md bg-ink-900 text-white hover:bg-ink-700 disabled:opacity-60 disabled:cursor-not-allowed"
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
