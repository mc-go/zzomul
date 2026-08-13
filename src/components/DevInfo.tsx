import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { LuCode, LuX, LuExternalLink, LuEye } from 'react-icons/lu';
import { DailyPopupView } from './DailyPopup';
import { MEMBER_EMPNOS } from '../lib/members';
import { getFortune } from '../lib/fortune';
import type { ReportComment } from '../lib/reports';

// 팝업 미리보기용 샘플 데이터 (실제 저장 안 됨)
function sampleReports() {
  const today = format(new Date(), 'yyyy-MM-dd');
  return [
    {
      id: -1,
      date: today,
      authorId: MEMBER_EMPNOS[1],
      content: '오늘 오후 반차예요~ 병원 다녀올게요 🏃',
      createdAt: '',
      updatedAt: '',
    },
  ];
}

function sampleNotices() {
  const today = format(new Date(), 'yyyy-MM-dd');
  return [
    {
      key: 'preview-birthday',
      kind: 'birthday' as const,
      emoji: '🎂',
      text: '박소현 생일',
      daysUntil: 0,
      date: today,
    },
    {
      key: 'preview-zzomul',
      kind: 'custom' as const,
      emoji: '🥨',
      text: '쪼물랭 2주년',
      daysUntil: 7,
      date: today,
    },
  ];
}

export default function DevInfo() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex fixed bottom-4 right-4 h-10 px-3 items-center gap-1.5 rounded-full bg-ink-900 text-white text-xs font-medium shadow-lg hover:bg-ink-700 z-40"
        title="개발 정보"
      >
        <LuCode className="text-sm" />
        개발 정보
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end p-0 sm:p-4 bg-ink-900/30 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none md:pointer-events-none"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-ink-200 max-h-[85vh] flex flex-col md:pointer-events-auto md:mb-16 md:mr-2"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
              <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
                <LuCode className="text-base" />
                개발 정보
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-400 hover:text-ink-900 p-1 rounded"
                aria-label="닫기"
              >
                <LuX />
              </button>
            </header>

            <div className="p-4 overflow-y-auto space-y-5 text-xs">
              <Section title="미리보기">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setPreview(true);
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-ink-200 text-ink-600 text-[11px] font-medium hover:bg-ink-50 hover:text-ink-900"
                >
                  <LuEye className="text-sm" />
                  오늘의 소식 팝업 미리보기
                </button>
                <p className="mt-1 text-ink-400">
                  다른 사람 화면에 뜨는 팝업을 샘플 데이터로 확인해요.
                </p>
              </Section>

              <Section title="저장소">
                <ExternalLink href="https://github.com/mc-go/zzomul">mc-go/zzomul</ExternalLink>
                <p className="mt-1 text-ink-400">Public repo — 소스 공개됨</p>
              </Section>

              <Section title="배포 URL">
                <ExternalLink href="https://mc-go.github.io/zzomul/">
                  mc-go.github.io/zzomul
                </ExternalLink>
                <p className="mt-1 text-ink-400">GitHub Pages · gh-pages 브랜치 서빙</p>
              </Section>

              <Section title="배포 방법">
                <ol className="space-y-1.5 text-ink-600 list-decimal list-inside marker:text-ink-300">
                  <li>
                    수정 후 <Code>git add . &amp;&amp; git commit -m "..."</Code>
                  </li>
                  <li>
                    <Code>git push</Code> → <Code>main</Code> 브랜치에 소스 반영
                  </li>
                  <li>
                    <Code>npm run deploy</Code> → 빌드 후{' '}
                    <Code>gh-pages</Code> 브랜치 push → 배포 자동 반영
                  </li>
                </ol>
                <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                  ⚠ <Code>main</Code>에 push해도 배포는 <b>안</b> 됩니다.{' '}
                  <Code>npm run deploy</Code>가 실제 배포 명령이에요.
                </p>
              </Section>

              <Section title="기술 스택">
                <ul className="space-y-0.5 text-ink-600">
                  <li>· Vite 6 + React 18 + TypeScript</li>
                  <li>· Tailwind CSS 3</li>
                  <li>· HashRouter (react-router-dom)</li>
                  <li>· @libsql/client (Turso)</li>
                  <li>· date-fns, react-icons</li>
                </ul>
              </Section>

              <Section title="외부 서비스">
                <ul className="space-y-1 text-ink-600">
                  <li>
                    <b className="text-ink-700">DB</b>: Turso (libSQL) —{' '}
                    <ExternalLink href="https://app.turso.tech">대시보드</ExternalLink>
                  </li>
                  <li>
                    <b className="text-ink-700">근태 API</b>: 듀얼아이 (
                    <Code>atdapi.duallmaster.com</Code>)
                  </li>
                </ul>
              </Section>

              <Section title="로컬 개발">
                <ol className="space-y-1.5 text-ink-600 list-decimal list-inside marker:text-ink-300">
                  <li>
                    <Code>.env.example</Code>를 <Code>.env.local</Code>로 복사
                  </li>
                  <li>
                    <Code>VITE_TURSO_URL</Code>, <Code>VITE_TURSO_TOKEN</Code> 값 채우기
                    <div className="mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                      ⚠ 이 값들은 <b>git에 없음</b> (public repo라 커밋 금지). 팀 채널이나
                      1Password 등으로 <b>따로 공유받기</b>.
                    </div>
                  </li>
                  <li>
                    <Code>npm install &amp;&amp; npm run dev</Code>
                  </li>
                </ol>
              </Section>

              <Section title="주요 스키마">
                <ul className="space-y-1 text-ink-600">
                  <li>
                    <Code>profiles</Code>: id(userId) · emp_no · email · icon_key · color_key · photo
                    · status_message · status_date
                  </li>
                  <li>
                    <Code>lunches</Code>: date · meal(lunch/dinner) · status(wishlist/done) ·
                    restaurant · rating · link · is_delivery · participants(JSON)
                  </li>
                  <li>
                    <Code>lunch_reviews</Code>: lunch_id + reviewer_id(PK) · rating(0.5 단위) ·
                    comment
                  </li>
                  <li>
                    <Code>reports</Code>: date + author_id(UNIQUE) · content — 오늘의 보고
                  </li>
                  <li>
                    <Code>report_comments</Code>: report_id + author_id(UNIQUE) · content — 1인
                    1댓글
                  </li>
                  <li>
                    <Code>anniversaries</Code>: owner_id · kind(birthday/hire/wedding/custom) ·
                    date · repeat(매년/100일/일회성) · remind_days(JSON)
                  </li>
                  <li>
                    <Code>lunch_plans</Code>: emp_no + date(PK) · note — 개인 점심 약속 (캘린더
                    🍽️ 뱃지)
                  </li>
                </ul>
                <p className="mt-1 text-[11px] text-ink-400">
                  캘린더 점심 구분: 🍜 쪼물런치(🛵 배달) · 🍽️ 개인 약속 · 🍱 도시락(둘 다 없는
                  평일, 자동)
                </p>
                <p className="mt-1 text-[11px] text-ink-400">
                  매주 고정 약속(<Code>RECURRING_LUNCH_PLANS</Code>)은 DB 없이 합성 — 공휴일·휴가
                  땐 제외, 토글로 끄면 skipped 행으로 그날만 쉬어가요. 도시락 리포트도 연차·오전
                  반차 날은 도시락에서 빼요
                </p>
                <p className="mt-1 text-[11px] text-ink-400">
                  운세 탭은 DB 저장 없음 — 생일+날짜 시드로 결정적 생성 (
                  <Code>src/lib/fortune.ts</Code>)
                </p>
                <p className="mt-1 text-[11px] text-ink-400">
                  스키마 변경은 <Code>ensureSchema</Code>에서 ALTER TABLE 자동 처리
                </p>
              </Section>

              <Section title="주의">
                <ul className="space-y-1 text-ink-600">
                  <li>
                    <Code>.env.local</Code>은 커밋 금지 (이미 gitignore)
                  </li>
                  <li>
                    빌드 결과에 Turso 토큰이 임베드됩니다 → 방문자면 소스에서 볼 수 있음
                  </li>
                  <li>사내 API 호출은 CORS 열려있는지 확인 필요</li>
                </ul>
              </Section>
            </div>

            <footer className="flex items-center justify-end px-4 py-2.5 border-t border-ink-100 bg-ink-50/40">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[11px] text-ink-500 hover:text-ink-900 px-2 py-1 rounded"
              >
                닫기
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {preview ? <PreviewPopup onClose={() => setPreview(false)} /> : null}
    </>
  );
}

// 샘플 데이터로 팝업을 그대로 띄워보는 미리보기 (댓글도 로컬에서만 동작)
function PreviewPopup({ onClose }: { onClose: () => void }) {
  const previewMe = MEMBER_EMPNOS[0];
  const [comments, setComments] = useState<Record<number, ReportComment[]>>({
    [-1]: [
      { id: -10, reportId: -1, authorId: MEMBER_EMPNOS[2], content: '몸조리 잘해요~ 🙌', createdAt: '' },
    ],
  });

  return (
    <DailyPopupView
      reports={sampleReports()}
      notices={sampleNotices()}
      comments={comments}
      fortune={getFortune(previewMe, '1999-10-19', format(new Date(), 'yyyy-MM-dd'))}
      myId={previewMe}
      onAddComment={async (reportId, content) => {
        setComments((prev) => ({
          ...prev,
          [reportId]: [
            ...(prev[reportId] ?? []).filter((c) => c.authorId !== previewMe),
            { id: -999, reportId, authorId: previewMe, content, createdAt: '' },
          ],
        }));
      }}
      onClose={onClose}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-[10px] font-medium text-ink-400 tracking-wide uppercase mb-1.5">
        {title}
      </h4>
      <div>{children}</div>
    </section>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-accent hover:underline underline-offset-2 decoration-1"
    >
      {children}
      <LuExternalLink className="text-[10px]" />
    </a>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1 py-px rounded bg-ink-100 text-ink-800 text-[11px] font-mono">
      {children}
    </code>
  );
}
