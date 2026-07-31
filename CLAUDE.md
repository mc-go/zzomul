# 쪼물랭 (zzomul)

사내 동료 3명이 함께 쓰는 웹앱: 근태 캘린더 + 먹기록(점심/저녁) + 오늘의 보고 + 기념일.

## 스택 / 구조

- Vite 6 + React 18 + TypeScript, Tailwind CSS 3
- **HashRouter** (react-router-dom) — GitHub Pages 서브패스 대응
- DB: **Turso (libSQL)** — `@libsql/client/web`, 브라우저에서 직접 접속
- 근태 API: 듀얼아이 (`atdapi.duallmaster.com`) — 로그인/근태/직원 목록
- `src/pages/` 탭 페이지 (근태 `/calendar` · 먹기록 `/lunch` · 보고 `/report`)
- `src/lib/` DB 접근 + 도메인 로직, `src/contexts/` 전역 상태(Auth/Profiles/AppData/Anniversaries)

## 명령어

```bash
npm run dev        # 개발 서버 (http://localhost:5173)
npm run typecheck  # 타입 체크 (tsc -b --noEmit)
npm run build      # tsc -b && vite build
npm run deploy     # 빌드 후 gh-pages 브랜치로 배포 ← 실제 배포 명령
```

⚠ **main에 push해도 배포되지 않음.** 배포는 반드시 `npm run deploy` (gh-pages 브랜치 서빙).
배포 URL: https://mc-go.github.io/zzomul/ · 저장소: https://github.com/mc-go/zzomul (**public**)

## 환경변수

`.env.local`에 `VITE_TURSO_URL`, `VITE_TURSO_TOKEN` 필요 (git에 없음 — 팀 채널로 공유).
**Public repo이므로 토큰/비밀값 절대 커밋 금지.**

## DB 스키마 규칙

- 테이블은 각 lib 파일의 `ensureXxxSchema()`가 앱 실행 시 자동 생성 (`CREATE TABLE IF NOT EXISTS`)
- 컬럼 추가는 같은 함수에서 `ALTER TABLE ... ADD COLUMN`을 try/catch로 실행 (중복이면 무시)
- 주요 테이블:
  - `profiles` — id(로그인 userId 기준) · emp_no · icon/color/photo · status_message
  - `lunches` — 먹기록 (status: wishlist/done, meal: lunch/dinner, participants JSON)
  - `lunch_reviews` — 참여자별 평 (lunch_id + reviewer_id PK, 별점 0.5 단위)
  - `reports` — 오늘의 보고 (date + author_id UNIQUE, 하루 1건 upsert)
  - `report_comments` — 보고 댓글 (report_id + author_id UNIQUE, 1인 1댓글 upsert, 본인 보고엔 불가)
  - `anniversaries` — 기념일 (kind: birthday/hire/wedding/custom, repeat: yearly/every100days/once, remind_days JSON)

## 도메인 메모

- 멤버 식별: 근태 API는 **사번(empNo)**, 로그인은 **이메일/userId**. 매핑은 `src/lib/members.ts` + 프로필의 emp_no. "내 사번" = 프로필 empNo → 자동 감지(myEmpNo) 순으로 폴백.
- 참여자 ID(`ParticipantId`) = 멤버 사번 + 퇴사자 등 추가 인물(`EXTRA_PARTICIPANTS`)
- 기념일 반복: 입사(hire)는 100일 단위, 생일/결혼은 매년 고정. 기타(custom)만 매년/100일 단위/일회성 선택 가능. **당일 알림은 무조건 팝업**, 그 외는 remind_days 설정을 따름.
- 첫 접속 팝업(`DailyPopup`): 오늘의 보고(남이 쓴 것) + 기념일 알림. 본 항목은 localStorage `zzomul.daily.seen.v1`에 기록.
- 근태 상태 코드: `1` 정상근무 · `70005` 오후반차 · `70006` 휴가 · 그 외 "기타"
- **공휴일**: `src/lib/holidays.ts`에 수동 관리 (대체공휴일 포함). ⚠ 연말마다 다음 해 날짜 추가 필요. 캘린더에 빨간 날짜+이름으로 표시.

## UI 컨벤션

- 색상 팔레트: `ink`(회색조) · `accent`(파랑) · `pretzel`(갈색), 배경은 크림톤(`#fdfaf3`) — tailwind.config.js 참고
- 모달은 LunchPage의 `ModalShell` 패턴(하단 시트 → sm 이상 중앙, `overflow-hidden` 필수) 따르기
- 커스텀 애니메이션: wiggle/float/bake + pop·burst(팝업 팡), rise(탭 전환), starpop(별점), spinonce(로고), cloud·bob(배경 음식)
  - ⚠ 콘텐츠 래퍼에 transform이 남는 애니메이션(fill 모드) 금지 — fixed 모달의 기준점이 어긋남 (rise가 fill 없는 이유)
  - ⚠ tailwind.config.js 수정은 dev 서버 재시작 필요 (핫리로드 안 됨)
- 배경 음식(`FloatingBreads`): 전 아이콘 이동 속도 150s 동일 유지 — 속도가 다르면 시간이 지나며 겹침. 추가 시 top 순서 기준 황금비 delay 규칙 따르기.
- 앱 내 텍스트는 전부 한국어, 말투는 "~해요"체
- 우측 하단 "개발 정보" 버튼(`src/components/DevInfo.tsx`)에 배포/스키마/주의사항 요약이 있음 — 구조가 바뀌면 이 패널도 함께 갱신할 것
