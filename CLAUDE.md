# 씬 카드 — 작업 규칙

한국어 글쓰기 앱. 씬 하나가 카드 한 장이고, 카드를 장(章)으로 나눠 식탁 위 포스트잇처럼 펼쳐 놓고 쓴다.
React 19 + TypeScript + Vite, 저장은 IndexedDB(기기) + Supabase(동기화), Netlify 배포.
작업 전에 `docs/next-steps.md`(방향과 남은 작업)와 `docs/interface.md`(화면과 동작)를 읽는다.

## 실행과 확인
- 설치: `npx pnpm@11.25.0 install --frozen-lockfile` (pnpm만 쓴다. `package-lock.json`을 만들지 않는다)
- 개발 서버: `npm run dev` / 타입 검사: `npm run typecheck` / 테스트: `npm test` / 배포 빌드: `npm run build:netlify` → `out/`
- 화면 확인: 데스크톱 1360px, 모바일 390px, 밝게·어둡게. 처음 여는 기기에는 예시 작품 「등대의 밤」이 들어 있다.

## 구조 (위에서 아래로만 의존한다)
- `src/domain/` 규칙집. 화면·저장을 모르는 순수 함수. 데이터를 바꾸는 새 동작은 여기에 함수로 만들고 `tests/domain.test.ts`에 테스트를 붙인다.
  - `types.ts` 모델(Project → chapters + scenes), `project.ts` 생성·검사·normalize·예전 원고 옮기기, `scenes.ts` 카드 조작, `chapters.ts` 장 조작, `lens.ts` 필터, `text.ts` 글자 수·조사, `sample.ts` 예시 작품
  - 장은 카드 순서 사이의 경계다. 카드는 `chapterId`만 갖고, `normalize`가 카드를 장 순서대로 모은다.
- `src/data/` 저장·동기화. `local.ts` IndexedDB, `repo.ts` 메모리 작품 목록(모든 변경의 입구), `sync.ts` 동기화 엔진, `remote.ts` 서버 약속, `supabase.ts` 로그인과 서버 구현. 테스트는 `tests/sync.test.ts`(가짜 서버).
- `src/io/transfer.ts` 내보내기(Word·Markdown·텍스트·백업)와 가져오기. 테스트 `tests/transfer.test.ts`.
- `src/state/` 화면 상태. `app.ts` 공용 객체와 훅, `actions.ts` 사용자 동작(되돌리기 알림 포함), `prefs.ts` 기기별 설정, `nav.ts` 주소(#/, #/read, #/write/<id>), `store.ts` 작은 저장소.
- `src/ui/` 공용 부품(`kit.tsx` 버튼·대화상자·메뉴·팝오버, `stage.tsx` 단계 점).
- `src/features/` 화면: `shell`(헤더·탭·찾기·작품), `board`(펼쳐보기), `write`(집필), `read`(이어보기), `lens`, `settings`.
- `src/styles/` `tokens.css`(색·글꼴, 여기서만 색을 정한다) → `base.css` → `ui.css` → 화면별 css.
- `supabase/migrations/` 서버 SQL. 스키마를 바꾸면 새 번호 파일을 추가하고 사용자에게 실행을 요청한다.

## 규칙
- 화면은 작품을 직접 고치지 않는다. `state/actions.ts`의 함수를 부르고, 되돌릴 수 있는 동작은 라벨을 붙여 알림에 '되돌리기'를 띄운다.
- 색은 `tokens.css`의 토큰만 쓴다. 색(팔레트 '노을 구름')은 진행 단계(`--stage`)와 선택(`--select`)에만 쓴다. 사용자가 붙이는 색 라벨은 만들지 않는다.
- 폰트는 Pretendard(화면), Noto Serif KR(본문 명조). 터치 영역은 44px 안팎을 지킨다.
- 헤더 오른쪽 순서는 [동기화][렌즈][찾기][설정][+]로 고정한다. 화면마다 생기고 사라지는 것은 왼쪽에 둔다.
- `!important`는 쓰지 않는다(움직임 줄이기 설정 한 곳 예외).

## 문구
- 쉬운 동사, 같은 동작은 어디서나 같은 이름. 상위 화면은 `펼쳐보기 / 이어보기`, 카드 화면은 `집필`, 보조 기록은 `노트`.
- 진행 단계 이름(구상·초고·퇴고·완료)은 카드에 글자로 쓰지 않고 색 점으로만 보여준다.
- 제목이 들어가는 알림은 `josa()`로 조사를 맞춘다.

## 작업 방식
- 한 단계씩 진행하고, 단계마다 타입 검사·테스트·빌드·화면 확인 후 보고한다. 사용자는 단계마다 코드 설명(비유 포함)을 원한다.
- 바뀐 동작은 `docs/interface.md`에, 진행 상황은 `docs/next-steps.md`에 반영한다.
