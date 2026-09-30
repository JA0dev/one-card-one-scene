# 씬 카드 — 작업 규칙

원카드 원씬 글쓰기 앱. 씬 하나가 카드 한 장이다. React + TypeScript + Vite, Netlify 배포.
작업을 시작하기 전에 `docs/next-steps.md`(방향과 남은 작업)와 `docs/interface.md`(현재 화면 구조)를 읽는다.

## 실행과 확인
- 설치: `npx pnpm@11.25.0 install --frozen-lockfile` (pnpm 사용. `package-lock.json`을 만들거나 커밋하지 않는다)
- 개발 서버: `npm run dev`
- 타입 검사: `npm run typecheck`
- 배포 빌드: `npm run build:netlify` → `out/`
- 테스트: `npm test`
- 화면 확인: 데스크톱 1360px, 모바일 390px. 작품 제목 → `예시 작품`으로 샘플 원고를 불러와 확인한다.
- 모바일 하단 요소를 볼 때는 실제로 끝까지 스크롤한 상태에서 판단한다. 스크롤을 임의 위치에 고정하고 가려졌다고 단정하지 않는다.

## 주요 파일
- `app/page.tsx`: 상태·저장·동기화와 화면 조립. 한 줄이 매우 긴 압축 스타일이다. 요청 없이 파일 전체를 재포맷하지 않는다(diff가 전부 바뀐다). 필요한 구간만 정확히 찾아 고친다.
- `components/studio/`: `scene-card`(보드 카드), `scene-menu`(카드·집필 `…` 메뉴), `dialogs`(작품 메뉴 하위 화면들), `fields`(공용 입력)
- `lib/scene-ops.ts`: 씬 조작 순수 함수(나누기·합치기·복제·이동·순서 복원). 씬 데이터를 바꾸는 새 동작은 여기에 함수로 만들고 `tests/scene-ops.test.mjs`에 테스트를 붙인다.
- `lib/io.ts`: 내보내기·가져오기
- `app/styles/tokens.css`: 색·폰트 토큰. `:root`는 여기서만 정의한다.
- `app/styles/workspace.css`: 작업실·카드·반응형. `!important`가 남아 있다. 건드리는 규칙부터 선택자 우선순위로 풀어서 줄인다.
- `app/styles/scene.css`: 노트·씬 이동·메뉴 보조 스타일.
- `lib/manuscript.ts`: 데이터 모델(Scene: title, summary, body, notes, pov, place, time, stage, bucket, versions).

## CSS 규칙
- 기존 선언 위치에서 고친다. 파일 끝에 덮어쓰기 블록을 추가하지 않는다.
- 기본 화면은 `tokens.css`의 토큰만 쓴다. 색(팔레트 '노을 구름')은 진행 단계(`--stage-*`)와 선택 표시(`--select`)에만 쓴다. 사용자가 붙이는 색 라벨은 만들지 않는다. 폰트(Pretendard, 본문 Noto Serif KR)는 바꾸지 않는다.
- 터치 영역은 44px 이상을 유지한다.

## 문구 규칙
- 쉬운 동사, 사용자가 이해하는 이름. 같은 동작은 흐름 내내 같은 이름을 쓴다.
- 상위 탭 이름은 `펼쳐보기 / 이어보기`다. 보류함은 휴지통으로 합쳤다(예전 데이터는 불러올 때 변환).
- 제목이 들어가는 알림은 받침에 따라 조사를 바꾼다(을/를 등).

## 작업 방식
- 한 단계씩 진행하고, 단계마다 타입 검사·빌드·테스트·데스크톱/모바일 화면 확인 후 결과를 보고한다.
- 바뀐 동작은 `docs/interface.md`에, 진행 상황은 `docs/next-steps.md`에 반영한다.
