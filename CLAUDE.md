# 쪼물랭 (zzomul)

사내 동료 3명이 함께 쓰는 웹앱: 근태 캘린더 + 먹기록(점심/저녁) + 오늘의 보고 + 기념일.

## 스택 / 구조

- Vite 6 + React 18 + TypeScript, Tailwind CSS 3
- **HashRouter** (react-router-dom) — GitHub Pages 서브패스 대응
- DB: **Turso (libSQL)** — `@libsql/client/web`, 브라우저에서 직접 접속
- 근태 API: 듀얼아이 (`atdapi.duallmaster.com`) — 로그인/근태/직원 목록
- `src/pages/` 탭 페이지 (근태 `/calendar` · 먹기록 `/lunch` · 지도 `/map` · 보고 `/report` · 운세 `/fortune` · 아무거나 `/memo` — 내비 순서: 근태·먹기록·지도·보고·운세·아무거나)
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
  - `users`(프로필) — id(로그인 userId 기준) · emp_no · name · icon/color/photo
  - `daily_statuses` — 오늘의 상태메시지 (emp_no + date PK)
  - `lunches` — 먹기록 (status: wishlist/done, meal: lunch/dinner, is_delivery, participants JSON) — rating은 레거시(입력 UI 없음, 리뷰 없는 옛 기록의 별점 표시 폴백), comment 컬럼 없음
  - `lunch_reviews` — 참여자별 평 (lunch_id + reviewer_id PK, 별점 0.5 단위)
  - `reports` — 오늘의 보고 (date + author_id UNIQUE, 하루 1건 upsert)
  - `report_comments` — 보고 댓글 (report_id + author_id UNIQUE, 1인 1댓글 upsert, 본인 보고엔 불가)
  - `anniversaries` — 기념일 (kind: birthday/hire/wedding/custom, repeat: yearly/every100days/once, remind_days JSON)
  - `lunch_plans` — 개인 점심 약속 (emp_no + date PK, note, skipped) — 캘린더에 🍽️ 뱃지, DatePanel 라벨 토글(🍱↔🍽️)은 멤버면 남의 것도 대신 가능, 약속 메모 수정/삭제는 본인 것만. skipped=1은 고정 약속을 그날만 쉬어가는 표시
  - `balance_votes` — 오늘의 밸런스 게임 투표 (date + voter_id PK, choice 'a'/'b') — 1인 1표 upsert. 질문 자체는 저장 안 함(날짜 시드로 결정적, `src/lib/balance.ts`)
  - `places` — 가게 좌표 (name_key PK = normalizeRestaurant 결과, name, lat, lng) — 지도 탭 핀용. 좌표 없는 가게는 지도에서 생략
  - `settings` — 팀 공유 키-값 (key PK) — 예: 절약 챌린지 목표액 `savings.goal.{연도}.{사번}`, 도시락 한 끼 칼로리 `dosirak.kcal.{사번}`(연도 무관)
- **매주 고정 약속**: `RECURRING_LUNCH_PLANS`(src/lib/lunch-plans.ts) — DB 저장 없이 캘린더에서 합성(`fixed: true`). 공휴일이거나 휴가 등으로 점심시간에 근무가 아니면 제외, 같은 날 직접 등록한 약속이 있으면 그쪽 우선. 예외 토글 가능: 끄면 `lunch_plans.skipped=1` 행으로 "그날만 쉬어감" 저장, 다시 켜면 행 삭제로 복구. 현재: 고민채(2023124) 금요일 "앱개발 팀 회식"
- 캘린더 점심 구분 3종: 🍜 쪼물런치(배달이면 🛵) · 🍽️ 개인 약속 · 🍱 도시락 — 도시락은 별도 데이터 없이 "쪼물런치(점심)도 개인 약속도 없는 평일(공휴일 제외)"에 자동 표시 (도시락/약속 라벨은 날짜 상세에서만, 캘린더 그리드엔 안 보임)
- 캘린더 하단 "도시락 리포트": 보는 달의 **사람별** 도시락/쪼물런치/약속 일수 + 절약액(1일 8,000원) — 쪼물런치·약속은 예정(미래)도 포함, 도시락만 오늘까지 지난 평일 기준. 연차(휴가)·안식휴가·오전 반차로 점심에 없던 날은 도시락에서 제외(`isAwayAtLunch` — 반차는 출근/근무예정 시작이 정오 이후면 오전 반차로 판정). 계산만, 저장 없음. 집계/약속 합성 로직은 `src/lib/lunch-stats.ts` 공용(연간 어워드 도시락왕도 같은 규칙)
- 캘린더 날짜 상세(DatePanel)는 날짜 숫자뿐 아니라 셀/카드의 빈 공간 클릭으로도 열림 (멤버 행 클릭은 stopPropagation으로 프로필 모달만). 맨 하단에 **타임캡슐** — 선택 날짜의 1년 전/6개월 전 같은 날 done 먹기록(메모리 데이터 재활용) + 보고(2일치 1회 조회), 내용 없으면 섹션 자체를 숨김

## 도메인 메모

- 멤버 식별: 근태 API는 **사번(empNo)**, 로그인은 **이메일/userId**. 매핑은 `src/lib/members.ts` + 프로필의 emp_no. "내 사번" = 프로필 empNo → 자동 감지(myEmpNo) 순으로 폴백.
- 참여자 ID(`ParticipantId`) = 멤버 사번 + 퇴사자 등 추가 인물(`EXTRA_PARTICIPANTS`)
- 기념일 반복: 입사(hire)는 100일 단위, 생일/결혼은 매년 고정. 기타(custom)만 매년/100일 단위/일회성 선택 가능. **당일 알림은 무조건 팝업**, 그 외는 remind_days 설정을 따름.
- 소식 팝업(`DailyPopup`): 오늘의 보고(남이 쓴 것) + 기념일 알림 + 오늘의 내 운세(하루 1회) + 오늘의 밸런스 게임(멤버만) + 월간 결산(매월 1~5일 1회) + 먹기록 업데이트 알림(멤버만). 접속 직후 1회 + 이후 **탭 이동·창 복귀·DB 쓰기(저장/투표 등, `db.ts`의 `DB_WRITE_EVENT`) 때 재확인**(팝업이 떠 있거나 10초 안 지났으면 건너뜀). 본 항목은 localStorage `zzomul.daily.seen.v1`에 기록 — 운세·기념일·결산은 1회만, **내 댓글을 단 보고와 투표한 밸런스는 아예 안 뜨고**, 댓글 안 단 보고·투표 안 한 밸런스·업데이트 안 한 기록은 **30분 쿨다운마다 리마인드**로 다시 뜸. 팝업은 body 포털로 렌더(헤더 backdrop-blur가 fixed 기준점을 가로채는 것 방지). **항목이 2종류 이상이면 상단 탭**(📊 결산 · 🎉 기념일 · 📢 보고 · 📝 기록 · 🔮 운세 · 🎮 게임 — 이 순서)으로 구분. 보고는 오늘 날짜만 조회하므로 전날 보고는 안 뜸. 게임 탭 = 밸런스 + (연말 시즌) 월드컵 개막 알림. 결산 탭 = 월간 결산 + (연말 시즌) 연말 리캡.
- **월간 결산**(`src/lib/monthly-recap.ts`): 매월 1~5일 팝업에 지난달 요약(런치/디너 횟수·주 평균·간 곳들) + 새 달 추천(위시리스트 중 안 가본 곳 우선, 계절 키워드 매칭 시 계절 사유) + 응원 한마디. 추천/응원은 월 시드로 결정적, DB 저장 없음. 지난달 기록이 없으면 생략.
- **연말 시즌**(`isYearEndSeason`, monthly-recap.ts): 12월 마지막 주(월요일 시작)의 한 주 전부터 연말까지. 이 기간에 **연말 리캡**(올해 총결산, 팝업 결산 탭, `recap-year-{연도}` 키 1회)과 **맛집 월드컵**(개막 알림 `worldcup-{연도}` 키 1회)이 활성화.
- **게임 코너**(아무거나 탭 상단): 타일 한 줄(평소 2개: 빙고·밸런스, 연말 시즌 3개: +월드컵 — grid-cols가 개수에 맞춰 바뀜), **타일 클릭 시 팝업으로 상세**(GameModal). 순서: 빙고 → 월드컵 → 밸런스.
  - **쪼물 빙고**(`src/lib/bingo.ts` + `components/Bingo.tsx`): 3×3 미션판, 월 시드로 미션 풀에서 9개 선택, 전부 기존 데이터로 자동 체크 — 저장 없음. **미션 삭제/key 변경 금지**(지난 달 판이 바뀜), 추가만.
  - **맛집 월드컵**(`components/WorldCup.tsx`): 연말 시즌 한정. 올해 done 가게 4곳 이상이면 방문수 상위 4/8/16강 토너먼트(대진은 매판 랜덤 셔플). 우승 결과는 버튼으로 메모에 저장(그 외 저장 없음).
- **프레첼 키우기**(`src/lib/pretzel-level.ts` + `components/PretzelLevel.tsx`): 헤더 로고 옆 Lv 뱃지. 경험치 = 기록·리뷰·보고·댓글·메모·투표 COUNT 합(조회 1번), 레벨 필요치는 10부터 5씩 증가. `DB_WRITE_EVENT`마다 15초 스로틀로 갱신, 세션 중 레벨업 시 뱃지 강조. 뱃지 클릭 → 요약 패널(진행 바·활동별 칩) → "상세 내역 보기" → **body 포털 팝업**에 레벨업 히스토리(전체 활동 시각을 걸어가며 계산) + 최근 경험치 10건. 저장 없음.
- **절약 챌린지**(`components/SavingsChallenge.tsx`의 `useSavingsChallenge`+`SavingsGauge`): 별도 블록 없이 **도시락 리포트 멤버 줄의 월 절약액 오른쪽 미니 게이지**로 표시(목표 설정한 사람만, hover로 상세). 집계는 근태 기반 도시락 하한(`lunch-stats.ts`의 `STATS_START`=2026-08-01, `statsStartOfYear`)을 따름 — **도시락왕도 같은 하한 적용**(그 전엔 기록이 거의 없어 도시락 일수가 부풀려짐). ⚠ 먹기록 어워드 등 기록 자체 집계는 하한 없이 올해 전체 포함. 근태 별도 1회 조회(게스트 숨김). 목표는 **연 단위·사람별**(`settings`의 `savings.goal.{연도}.{사번}`) — 헤더 ⚙️ 설정 → **"웰빙 저금통 설정"** 팝업(`SavingsGoalEditor`)에서 본인 것만, 비우고 저장하면 해제. 같은 팝업에서 **도시락 한 끼 칼로리**(`dosirak.kcal.{사번}`, 연도 무관)도 설정 — 도시락 리포트 멤버 줄(🔥 kcal = 한 끼 kcal × 도시락 일수, ≈ 🏃 달리기 600kcal/h 환산 병기·툴팁에 걷기 240kcal/h)과 어워드 도시락왕 순위 줄에 표시(미설정이면 생략).
- **MBTI**: 프로필 편집에서 16타입 그리드로 선택(다시 누르면 해제), `settings`의 `mbti.{참여자ID}`에 저장. 운세 카드 헤더의 띠·별자리 뱃지 줄에 보라색 뱃지로 표시.
- **먹BTI**(`src/lib/mukbti.ts`, **운세 탭 각 카드 하단**): 음식 장르 축 — **방문 비율이 아니라 내가 남긴 별점으로 판정**(쪼물런치는 셋이 같이 다녀 방문 분포가 비슷하므로): 가게명+메뉴 키워드 분류(`CUISINES` — 한식/분식/중식/일식/아시아/양식/치킨/카페·간식, 키워드 추가 자유 — 저장이 없어 결과가 바뀌어도 무해) 후 장르별 내 평점 평균 최고가 "OO파"(내 별점 2개 이상 장르만 후보, 동점은 감탄 한줄평 수→표본 수, 후보 없으면 "잡식파") × 내 평균 별점 4단계(천사입맛 4.5/너그러운 입맛 4.0/균형 미식가 3.5/깐깐 미식가, 별점 3개 미만이면 "미지의 입맛"). 설명 문장에 실제 수치 포함 + 개성 칩 최대 4개(🥈 부캐 장르(2위 평 4.0+)·🧊 꼴찌 장르(1위보다 1점 이상 낮으면)·🔁 아는 맛 중시(재방문율)·🛵 편하게 먹기·🌙 저녁 모임·별점 편차·만점·한줄평 길이/감탄·성실 기록) + 최애 가게(내 별점 최고, 동점은 방문 많은 곳). 참여 5회 미만이면 보류 안내. 생일 미등록 멤버 카드에도 표시. 페이지 진입 시 1회 조회, 저장 없음. 운세 탭 맨 하단에 **입맛 궁합**(`computeTasteMatches`) — 같은 기록에 두 사람이 남긴 별점 차 평균으로 페어 점수(0~100)·라벨, 같이 별점 남긴 기록 3개 미만이면 보류 표시.
- **먹기록 업데이트 알림**: 날짜(plannedDate) 지난 위시 기록 — 점심은 당일 12시(`LUNCH_DONE_HOUR`), 저녁은 자정 지나면 팝업 📝 기록 탭으로 재촉. 참여자 지정 시 내가 낀 것만, 다녀왔어요 처리 전까지 리마인드. **내 평 리마인드**도 같은 탭 — 최근 7일(`REVIEW_REMIND_DAYS`) 내 다녀온 기록 중 내가 참여했는데 lunch_reviews에 내 평이 없는 것.
- **밸런스 게임**(`src/lib/balance.ts`): 질문은 날짜 시드로 결정적 선택(운세와 같은 방식, 시드 유틸은 fortune.ts에서 export), 투표만 `balance_votes`에 저장. 내가 투표하기 전엔 결과 비공개, 투표 후 득표·선택자 공개, 재투표로 변경 가능. 질문 풀에서 삭제/순서 변경 금지(지난 날짜 질문이 바뀜) — 추가만. 팝업 외에 **아무거나 탭 상단**에도 상시 표시(`BalanceSection` 공용 — DailyPopup.tsx에서 export).
- **운세**(`src/lib/fortune.ts`): 생일(→띠·별자리) + **MBTI** + 오늘 날짜를 시드로 한 결정적 생성 — DB 저장 없음, 같은 날 누가 봐도 동일. MBTI를 바꾸면 그날 운세도 바뀜. 팝업의 내 운세도 MBTI를 같이 넘겨야 운세 탭과 일치. 생일 미등록 멤버는 운세 대신 등록 안내 표시.
- **지도 탭**(`src/pages/MapPage.tsx`): Leaflet + OpenStreetMap(API 키 불필요). 다녀온(done) 가게 중 `places`에 좌표가 있는 곳만 핀(방문 횟수 뱃지, 점심 기록 있으면 🍜·저녁만 간 곳은 🌙), 팝업에 횟수(점심/저녁 섞이면 나눠 표기)·평균 별점. 좌표 지정은 멤버만 — "칩 클릭 → 지도 클릭". **탭 진입 시 핀 없는 가게의 최신 네이버 링크를 자동 해석**(`src/lib/place-resolver.ts` — URL 좌표 파라미터 직접 파싱 + allorigins CORS 프록시 베스트에포트, 실패 링크는 세션 캐시로 재시도 안 함). 더 안정적인 일괄 처리는 `node scripts/backfill-places.mjs`. leaflet 컨테이너에 `relative z-0 isolate` 필수(내부 z-index가 헤더/모달을 덮는 것 방지).
- **알림 종**: 헤더 설정 아이콘 왼쪽(DailyPopup이 종 버튼+팝업을 함께 렌더). 하루 최초 1회(localStorage `zzomul.daily.autoshown.v1`)는 자동 팝업, 이후엔 종 뱃지(탭 개수)만 갱신되고 소식 있으면 종이 wiggle. 클릭하면 같은 팝업.
- **당겨서 새로고침**(`src/components/PullToRefresh.tsx`): 홈 화면 앱(standalone)에서만 동작 — 일반 브라우저는 기본 기능 사용. 모달(role="dialog")·leaflet 지도 위 드래그는 무시.
- **먹기록 어워드**(`src/components/LunchAwards.tsx`): 먹기록 탭 맨 위, 올해 done 기록 기준 — 상단에 🍜 쪼물런치(외식/배달 구분)·🌙 쪼물디너 횟수 칩. 어워드 6종(이 순서): 최고 맛집(**멤버 참여자 전원이 별점 남긴 기록만** 집계, 동점은 공동 1위 병기 — 리뷰 많은 순 3곳까지, 넘치면 "외 n곳")·가장 많이 간 곳(2회 이상만)·먹부림 피크(최다 월+최다 요일 한 카드)·최장 연속 주간(먹은 날짜 기준, 기록 있는 주가 몇 주 연속인지·진행 중 표시)·리뷰왕(+😇 천사 입맛/🌶️ 깐깐 미식가 — 별점 3개 이상 남긴 사람 중 평균 최고/최저)·도시락왕(한 줄에 일수·💰절약액·🔥칼로리 함께 — 칼로리는 웰빙 저금통에 kcal 등록자만, 우승자는 절약 1위와 칼로리 1위를 각각 뽑아 다르면 "💰 A / 🔥 B"로 병기). `normalizeRestaurant`는 lunch-stats.ts로 이동(LunchAwards에서 재수출). 도시락왕만 올해치(1/1~오늘) 근태를 별도 1회 조회(게스트는 생략)하고 **전원 순위(🥇🥈🥉 일수·절약액)** 표시. 계산만, 저장 없음.
- **단골 뱃지**: 같은 가게(공백·대소문자 무시, `normalizeRestaurant`) done 기록이 2건 이상이면 날짜순 2회차부터 "🔥 단골 n회차" 표시.
- **캘린더 위젯**(`src/components/CalendarWidgets.tsx`): 캘린더 탭 상단 그리드(모바일 2×2), 전부 "오늘" 기준이라 보는 달과 무관 — 🌡️ 사무실 온도(근무 1·반차 0.5·휴가 0, 오늘 근태만 별도 1회 조회, 주말·공휴일은 휴식 메시지 — 하단에 바깥 실제 날씨 한 줄: `src/lib/weather.ts`, Open-Meteo 키 불필요·사무실 좌표 하드코딩·30분 모듈 캐시·실패 시 생략) · 🎂 다가오는 기념일 D-day · 📅 다음 빨간날 · 📢 오늘 보고 현황(클릭 시 보고 탭 이동). 계산만, 저장 없음.
- **별점·한줄평은 오직 lunch_reviews(참여자 개인 평)에만 저장** — 기록 자체에 별점/평을 받는 UI를 다시 만들지 말 것 (과거 lunches.comment 이관 로직이 남의 평으로 옮기는 버그가 있었고, 해당 컬럼은 삭제됨. 재도입 금지).
- 근태 상태 코드: `1` 정상근무 · `70005` 오후반차 · `70006` 휴가 · 그 외 "기타"
- **공휴일**: `src/lib/holidays.ts`에 수동 관리 (대체공휴일 포함). ⚠ 연말마다 다음 해 날짜 추가 필요 — 12월에 다음 해 데이터가 없으면 "다음 빨간날" 위젯이 경고 표시(`hasHolidaysForYear`). 캘린더에 빨간 날짜+이름으로 표시.
- **캘린더 UX**: 월 근태는 세션 캐시(캐시 먼저 그리고 백그라운드 갱신 — 캐시 있으면 로딩 오버레이 생략) · "오늘" 버튼(월 복귀+오늘 셀/카드로 스크롤) · 년월 타이틀 클릭 → 연도 이동+12개월 그리드 피커 · 캘린더 영역 가로 스와이프(60px 이상, 세로의 1.5배)로 월 이동 · **모바일 보기 3종**(📅 미니 달력: 이모지 요약+멤버 근태 점 / 🗓️ 주차별: 하루 한 줄 요약 / 📋 일별: 기존 카드 — localStorage `zzomul.calendar.mobileView.v1`에 기억) · 일별 보기는 주차 구분선 + 지난 날짜 opacity 톤 다운, 탭 진입 시 오늘 카드로 1회 자동 스크롤(미니 달력 보기 제외, sticky 헤더만큼 `scroll-mt-16`) · DatePanel 헤더 ◀▶로 날짜 이동(주말 건너뜀, 달이 바뀌면 커서도 이동) · 도시락 리포트 접기(localStorage `zzomul.dosirak.collapsed.v1`), 절약 게이지는 목표 미설정자에게 "🎯 목표를 설정해주세요!" 안내 표시 · 미니 달력/주차별 보기의 근태 점은 테두리가 프로필 색(`getAvatarColor`), 안쪽이 근태 상태 색.

## UI 컨벤션

- 색상 팔레트: `ink`(회색조) · `accent`(파랑) · `pretzel`(갈색), 배경은 크림톤(`#fdfaf3`) — tailwind.config.js 참고
- 모달은 LunchPage의 `ModalShell` 패턴(하단 시트 → sm 이상 중앙, `overflow-hidden` 필수) 따르기
- 커스텀 애니메이션: wiggle/float/bake + pop·burst(팝업 팡), rise(탭 전환), starpop(별점), spinonce(로고), cloud·bob(배경 음식)
  - ⚠ 콘텐츠 래퍼에 transform이 남는 애니메이션(fill 모드) 금지 — fixed 모달의 기준점이 어긋남 (rise가 fill 없는 이유)
  - ⚠ tailwind.config.js 수정은 dev 서버 재시작 필요 (핫리로드 안 됨)
- 배경 음식(`FloatingBreads`): 전 아이콘 이동 속도 150s 동일 유지 — 속도가 다르면 시간이 지나며 겹침. 추가 시 top 순서 기준 황금비 delay 규칙 따르기.
- 앱 내 텍스트는 전부 한국어, 말투는 "~해요"체
- 우측 하단 "개발 정보" 버튼(`src/components/DevInfo.tsx`)에 배포/스키마/주의사항 요약이 있음 — 구조가 바뀌면 이 패널도 함께 갱신할 것
