import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LuMegaphone, LuTrash2, LuPencil } from 'react-icons/lu';
import { GiPretzel } from 'react-icons/gi';
import {
  deleteReport,
  ensureReportsSchema,
  listRecentReports,
  upsertReport,
  type Report,
} from '../lib/reports';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import Avatar from '../components/Avatar';

export default function ReportPage() {
  const { session } = useAuth();
  const { getProfile, getProfileByEmpNo } = useProfiles();
  const { resolveName, myEmpNo } = useAppData();
  const me = session?.userId ? String(session.userId) : '';
  // 내 참여자 ID(사번): 프로필에 저장된 값 우선, 없으면 자동 감지값
  const myPid = (me ? getProfile(me)?.empNo : '') || myEmpNo || '';

  const today = format(new Date(), 'yyyy-MM-dd');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const myToday = useMemo(
    () => reports.find((r) => r.date === today && r.authorId === myPid) ?? null,
    [reports, today, myPid],
  );

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      await ensureReportsSchema();
      const rows = await listRecentReports();
      setReports(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // 최초 로딩 시 오늘 내가 쓴 보고가 있으면 편집칸에 미리 채움
  useEffect(() => {
    if (draftLoaded || loading) return;
    if (myToday) setDraft(myToday.content);
    setDraftLoaded(true);
  }, [draftLoaded, loading, myToday]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !myPid) return;
    const content = draft.trim();
    if (!content) {
      setError('보고 내용을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertReport(today, myPid, content);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(report: Report) {
    if (!confirm('이 보고를 삭제할까요?')) return;
    try {
      await deleteReport(report.id);
      if (report.id === myToday?.id) setDraft('');
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패');
    }
  }

  // 날짜별 그룹 (최근 날짜부터)
  const grouped = useMemo(() => {
    const map = new Map<string, Report[]>();
    for (const r of reports) {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    }
    return [...map.entries()];
  }, [reports]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">보고</h1>
        <p className="text-xs text-ink-400 mt-0.5">오늘의 소식을 남기면 팀원들 화면에 짠! 하고 나타나요.</p>
      </div>

      {error ? (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      ) : null}

      {/* 오늘의 보고 작성 카드 */}
      <section className="rounded-2xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 to-white p-4 sm:p-5 mb-8">
        <header className="flex items-center gap-2 mb-3">
          <GiPretzel className="text-xl text-pretzel animate-wiggle" />
          <h2 className="text-sm font-semibold text-ink-900">
            오늘의 보고 <span className="text-ink-400 font-normal">· {format(new Date(), 'M월 d일 (EEE)', { locale: ko })}</span>
          </h2>
          {myToday ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              <LuPencil className="text-[10px]" />
              작성 완료 · 다시 저장하면 수정돼요
            </span>
          ) : null}
        </header>

        {myPid ? (
          <form onSubmit={submit} className="space-y-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="공유하고 싶은 소식을 남겨보세요. 예: 오늘 오후 반차예요 🏃"
              className="w-full px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm placeholder-ink-300 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-ink-900 text-white text-xs font-medium hover:bg-ink-700 disabled:opacity-60"
              >
                <LuMegaphone className="text-sm" />
                {busy ? '전하는 중...' : myToday ? '보고 수정' : '보고하기'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-ink-500">
            프로필에서 사번을 설정하면 보고를 쓸 수 있어요. (우측 상단 아바타 클릭)
          </p>
        )}
      </section>

      {/* 지난 보고 목록 */}
      {loading && reports.length === 0 ? (
        <div className="text-xs text-ink-400">불러오는 중...</div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-pretzel/30 bg-white/50 py-8 px-6 text-center">
          <p className="text-xs text-ink-400">아직 보고가 없어요. 첫 소식을 전해보세요! 📢</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, rows]) => (
            <section key={date}>
              <h3 className="text-xs font-semibold text-ink-500 mb-2">
                {format(new Date(date), 'M월 d일 (EEE)', { locale: ko })}
                {date === today ? (
                  <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-pretzel text-white">오늘</span>
                ) : null}
              </h3>
              <ul className="space-y-2">
                {rows.map((r) => {
                  const name = resolveName(r.authorId);
                  return (
                    <li
                      key={r.id}
                      className="flex items-start gap-2.5 rounded-2xl border border-ink-100 bg-white px-3.5 py-3 shadow-card"
                    >
                      <Avatar profile={getProfileByEmpNo(r.authorId)} size="sm" fallbackText={name} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-ink-700">{name}</p>
                        <p className="text-sm text-ink-600 mt-0.5 whitespace-pre-wrap">{r.content}</p>
                      </div>
                      {r.authorId === myPid ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          className="text-ink-300 hover:text-red-600 p-1.5 rounded hover:bg-red-50 shrink-0"
                          aria-label="삭제"
                          title="삭제"
                        >
                          <LuTrash2 className="text-sm" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
