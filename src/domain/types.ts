// 씬 카드의 데이터 모델. 작품(Project) 하나가 저장·동기화의 단위다.
// 카드(Scene)의 순서는 scenes 배열 순서이고, 장(Chapter)은 그 순서를 나누는 경계다.

export const SCHEMA = 2 as const;

export const STAGES = ['idea', 'draft', 'revise', 'done'] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = { idea: '구상', draft: '초고', revise: '퇴고', done: '완료' };

export type Version = { at: string; title: string; body: string };

export type Scene = {
  id: string;
  title: string;
  summary: string;
  body: string;
  notes: string;
  pov: string;
  place: string;
  time: string;
  stage: Stage;
  /** 장이 없는 작품이면 null */
  chapterId: string | null;
  /** 휴지통에 넣은 시각. 사용 중이면 null */
  trashedAt: string | null;
  versions: Version[];
  updatedAt: string;
};

export type Chapter = { id: string; title: string };

export type Project = {
  schema: typeof SCHEMA;
  id: string;
  title: string;
  subtitle: string;
  /** 비어 있으면 장 없이 카드만 보여준다 */
  chapters: Chapter[];
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
};

/** 백업 파일 형식 */
export type Backup = { kind: 'scene-card-backup'; schema: typeof SCHEMA; exportedAt: string; projects: Project[] };
