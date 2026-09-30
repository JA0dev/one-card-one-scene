# 씬 카드 — 작업 규칙

원카드 원씬 글쓰기 앱. 씬 하나가 카드 한 장이다. React + TypeScript + Vite, Netlify 배포.
작업을 시작하기 전에 `docs/next-steps.md`(방향과 남은 작업)와 `docs/interface.md`(현재 화면 구조)를 읽는다.

## 실행과 확인
- 설치: `pnpm install --frozen-lockfile` (pnpm 사용. `package-lock.json`을 만들거나 커밋하지 않는다)
- 개발 서버: `pnpm exec vite --config vite.netlify.config.ts`
- 타입 검사: `npx tsc --noEmit -p tsconfig.json`
- 배포 빌드: `pnpm run build:netlify` → `out/`
- 테스트: `node --test tests/*.test.mjs` (폴더 경로 `tests/`로 주면 모듈 오류가 난다)
- 화면 확인: 데스크톱 1360px, 모바일 390px. 작품 제목 → `예시 작품`으로 샘플 원고를 불러와 확인한다.
- 모바일 하단 요소를 볼 때는 실제로 끝까지 스크롤한 상태에서 판단한다. 스크롤을 임의 위치에 고정하고 가려졌다고 단정하지 않는다.

## 주요 파일
- `app/page.tsx`: 화면과 동작 전부. 한 줄이 매우 긴 압축 스타일이다. 요청 없이 파일 전체를 재포맷하지 않는다(diff가 전부 바뀐다). 필요한 구간만 정확히 찾아 고친다.
- `app/styles/tokens.css`: 색·폰트 토큰. `:root`는 여기서만 정의한다.
- `app/styles/workspace.css`: 작업실·카드·반응형. `!important`가 남아 있다. 건드리는 규칙부터 선택자 우선순위로 풀어서 줄인다.
- `app/styles/scene.css`: 노트·씬 이동·메뉴 보조 스타일.
- `lib/manuscript.ts`: 데이터 모델(Scene: title, summary, body, notes, pov, place, time, stage, bucket, versions).

## CSS 규칙
- 기존 선언 위치에서 고친다. 파일 끝에 덮어쓰기 블록을 추가하지 않는다.
- 색은 무채색 토큰만 쓴다. 폰트(Pretendard, 본문 Noto Serif KR)는 바꾸지 않는다.
- 터치 영역은 44px 이상을 유지한다.

## 문구 규칙
- 쉬운 동사, 사용자가 이해하는 이름. 같은 동작은 흐름 내내 같은 이름을 쓴다.
- 보관함 이름은 `사용 중 / 보류함 / 휴지통`이다. `원고`는 `전체원고` 탭과 겹치므로 보관함 이름으로 쓰지 않는다.
- 제목이 들어가는 알림은 받침에 따라 조사를 바꾼다(을/를 등).

## 작업 방식
- 한 단계씩 진행하고, 단계마다 타입 검사·빌드·테스트·데스크톱/모바일 화면 확인 후 결과를 보고한다.
- 바뀐 동작은 `docs/interface.md`에, 진행 상황은 `docs/next-steps.md`에 반영한다.
