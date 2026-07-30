# 쪼물랭

사내 동료 3명이 함께 보는 근태 캘린더 + 점심 기록 웹앱.

## 스택

- Vite + React + TypeScript
- Tailwind CSS
- React Router
- `@libsql/client/web` (Turso)
- `date-fns`, `react-icons`

## 설정

### 1) 의존성 설치

```bash
npm install
```

### 2) 환경변수

`.env.example` 을 `.env.local` 로 복사한 뒤 값 채우세요.

```bash
cp .env.example .env.local
```

`.env.local`:

```
VITE_TURSO_URL=libsql://<db-name>-<username>.aws-ap-northeast-1.turso.io
VITE_TURSO_TOKEN=<Turso Auth Token>
```

Turso 값 얻는 곳: [app.turso.tech](https://app.turso.tech) → 해당 DB → **Connect** 탭.

### 3) Turso 스키마

앱을 처음 실행하면 `lunches` 테이블이 자동으로 생성됩니다 (`ensureSchema`). 별도 마이그레이션 불필요.

수동으로 미리 만들고 싶다면 Turso 웹 Shell에서:

```sql
CREATE TABLE IF NOT EXISTS lunches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  restaurant TEXT NOT NULL,
  menu TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 0,
  comment TEXT NOT NULL DEFAULT '',
  participants TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lunches_date ON lunches(date DESC);
```

## 실행

```bash
npm run dev       # 개발 서버 (http://localhost:5173)
npm run build     # 프로덕션 빌드 (dist/)
npm run preview   # 빌드 결과 로컬 확인
npm run typecheck # 타입 체크
```

## 사용법

1. 듀얼아이 이메일/비밀번호로 로그인 (`https://atdapi.duallmaster.com/login` 직접 호출)
2. **근태** 탭: 3명(empNo `2023124`, `2023020`, `2024019`)의 월별 근태 확인
3. **점심** 탭: 점심 기록 추가/조회/삭제 (별점 5점, 참여자 체크박스)

## 참고

- 근태 API 토큰은 브라우저 `localStorage` 에만 저장됩니다.
- Turso 토큰은 빌드 결과에 포함되므로 저장소는 **private** 로 두세요.
- 필터링할 empNo 는 `src/lib/members.ts` 에서 관리합니다.
- 근태 상태 코드: `1` = 정상근무, `70005` = 오후반차, `70006` = 휴가. 그 외는 "기타"로 표기.

## 배포

정적 SPA 이므로 어디든 올릴 수 있습니다:

- **GitHub Pages** — `dist/` 를 `gh-pages` 브랜치로 배포
- **Vercel** — GitHub 저장소 연결만 하면 됨
- **Cloudflare Pages** — 마찬가지

Vite 는 기본 `base: '/'` 이므로 GH Pages 서브패스로 배포하려면 `vite.config.ts` 에서 `base: '/<repo-name>/'` 로 조정하세요.
