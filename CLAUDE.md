# 쪼물랭 (zzomul)

사내 동료 3명이 함께 쓰는 웹앱: 근태 캘린더 + 먹기록(점심/저녁) + 오늘의 보고 + 기념일.

## 스택 / 구조

- Vite 6 + React 18 + TypeScript, Tailwind CSS 3
- **HashRouter** (react-router-dom) — GitHub Pages 서브패스 대응
- DB: **Turso (libSQL)** — `@libsql/client/web`, 브라우저에서 직접 접속
- 근태 API: 듀얼아이 (`atdapi.duallmaster.com`) — 로그인/근태/직원 목록
- `src/pages/` 탭 페이지 (근태 `/calendar` · 먹기록 `/lunch` · 보고 `/report` · 아무거나 `/memo` · 운세 `/fortune`)
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
  - `lunches` — 먹기록 (status: wishlist/done, meal: lunch/dinner, is_delivery, participants JSON)
  - `lunch_reviews` — 참여자별 평 (lunch_id + reviewer_id PK, 별점 0.5 단위)
  - `reports` — 오늘의 보고 (date + author_id UNIQUE, 하루 1건 upsert)
  - `report_comments` — 보고 댓글 (report_id + author_id UNIQUE, 1인 1댓글 upsert, 본인 보고엔 불가)
  - `anniversaries` — 기념일 (kind: birthday/hire/wedding/custom, repeat: yearly/every100days/once, remind_days JSON)
  - `lunch_plans` — 개인 점심 약속 (emp_no + date PK, note, skipped) — 캘린더에 🍽️ 뱃지, DatePanel에서 본인 것만 등록/삭제. skipped=1은 고정 약속을 그날만 쉬어가는 표시
  - `balance_votes` — 오늘의 밸런스 게임 투표 (date + voter_id PK, choice 'a'/'b') — 1인 1표 upsert. 질문 자체는 저장 안 함(날짜 시드로 결정적, `src/lib/balance.ts`)
- **매주 고정 약속**: `RECURRING_LUNCH_PLANS`(src/lib/lunch-plans.ts) — DB 저장 없이 캘린더에서 합성(`fixed: true`). 공휴일이거나 휴가 등으로 점심시간에 근무가 아니면 제외, 같은 날 직접 등록한 약속이 있으면 그쪽 우선. 예외 토글 가능: 끄면 `lunch_plans.skipped=1` 행으로 "그날만 쉬어감" 저장, 다시 켜면 행 삭제로 복구. 현재: 고민채(2023124) 금요일 "앱개발 팀 회식"
- 캘린더 점심 구분 3종: 🍜 쪼물런치(배달이면 🛵) · 🍽️ 개인 약속 · 🍱 도시락 — 도시락은 별도 데이터 없이 "쪼물런치(점심)도 개인 약속도 없는 평일(공휴일 제외)"에 자동 표시 (도시락/약속 라벨은 날짜 상세에서만, 캘린더 그리드엔 안 보임)
- 캘린더 하단 "도시락 리포트": 보는 달의 **사람별** 도시락/쪼물런치/약속 일수 + 절약액(1일 8,000원) — 쪼물런치·약속은 예정(미래)도 포함, 도시락만 오늘까지 지난 평일 기준. 연차(휴가)·안식휴가·오전 반차로 점심에 없던 날은 도시락에서 제외(`isAwayAtLunch` — 반차는 출근/근무예정 시작이 정오 이후면 오전 반차로 판정). 계산만, 저장 없음. 집계/약속 합성 로직은 `src/lib/lunch-stats.ts` 공용(연간 어워드 도시락왕도 같은 규칙)
- 캘린더 날짜 상세(DatePanel)는 날짜 숫자뿐 아니라 셀/카드의 빈 공간 클릭으로도 열림 (멤버 행 클릭은 stopPropagation으로 프로필 모달만)

## 도메인 메모

- 멤버 식별: 근태 API는 **사번(empNo)**, 로그인은 **이메일/userId**. 매핑은 `src/lib/members.ts` + 프로필의 emp_no. "내 사번" = 프로필 empNo → 자동 감지(myEmpNo) 순으로 폴백.
- 참여자 ID(`ParticipantId`) = 멤버 사번 + 퇴사자 등 추가 인물(`EXTRA_PARTICIPANTS`)
- 기념일 반복: 입사(hire)는 100일 단위, 생일/결혼은 매년 고정. 기타(custom)만 매년/100일 단위/일회성 선택 가능. **당일 알림은 무조건 팝업**, 그 외는 remind_days 설정을 따름.
- 첫 접속 팝업(`DailyPopup`): 오늘의 보고(남이 쓴 것) + 기념일 알림 + 오늘의 내 운세(하루 1회) + 오늘의 밸런스 게임(하루 1회, 멤버만). 본 항목은 localStorage `zzomul.daily.seen.v1`에 기록. **항목이 2종류 이상이면 상단 탭**(🎉 기념일 · 🔮 운세 · 📢 보고 · ⚖️ 밸런스)으로 구분.
- **밸런스 게임**(`src/lib/balance.ts`): 질문은 날짜 시드로 결정적 선택(운세와 같은 방식, 시드 유틸은 fortune.ts에서 export), 투표만 `balance_votes`에 저장. 내가 투표하기 전엔 결과 비공개, 투표 후 득표·선택자 공개, 재투표로 변경 가능. 질문 풀에서 삭제/순서 변경 금지(지난 날짜 질문이 바뀜) — 추가만. 팝업 외에 **아무거나 탭 상단**에도 상시 표시(`BalanceSection` 공용 — DailyPopup.tsx에서 export).
- **운세**(`src/lib/fortune.ts`): 생일(anniversaries의 birthday) + 오늘 날짜를 시드로 한 결정적 생성 — DB 저장 없음, 같은 날 누가 봐도 동일. 생일 미등록 멤버는 운세 대신 등록 안내 표시.
- **먹기록 어워드**(`src/components/LunchAwards.tsx`): 먹기록 탭 맨 위, 올해 done 기록 기준 — 최고 맛집(리뷰 평균 우선)·가장 많이 간 곳(2회 이상만)·배달왕·리뷰왕·도시락왕. 도시락왕만 올해치(1/1~오늘) 근태를 별도 1회 조회(게스트는 생략)하고 **전원 순위(🥇🥈🥉 일수·절약액)** 표시. 계산만, 저장 없음.
- **단골 뱃지**: 같은 가게(공백·대소문자 무시, `normalizeRestaurant`) done 기록이 2건 이상이면 날짜순 2회차부터 "🔥 단골 n회차" 표시.
- **캘린더 위젯**(`src/components/CalendarWidgets.tsx`): 캘린더 탭 상단 그리드(모바일 2×2), 전부 "오늘" 기준이라 보는 달과 무관 — 🌡️ 사무실 온도(근무 1·반차 0.5·휴가 0, 오늘 근태만 별도 1회 조회, 주말·공휴일은 휴식 메시지) · 🎂 다가오는 기념일 D-day · 📅 다음 빨간날 · 📢 오늘 보고 현황(클릭 시 보고 탭 이동). 계산만, 저장 없음.
- **"다녀왔어요" 한줄평/별점은 누른 사람 본인의 평(lunch_reviews)으로 저장** — `lunches.comment`에 쓰면 안 됨 (과거 이관 로직이 남의 평으로 옮기는 버그가 있었음. 이관 로직은 제거됐고 재도입 금지).
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
