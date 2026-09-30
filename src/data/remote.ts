// 서버 저장소의 약속. Supabase 말고 다른 서버로 바꿔도 이 모양만 맞추면 된다.
import type { Project } from '@/domain/types';

export type RemoteHead = { id: string; revision: number; deleted: boolean };
export type RemoteRow = RemoteHead & { payload: Project | null };

export type SaveResult =
  | { ok: true; revision: number }
  /** 그 사이 다른 기기가 바꿨다. 서버의 현재 내용을 함께 돌려준다. */
  | { ok: false; revision: number; deleted: boolean; payload: Project | null };

export interface Remote {
  /** 로그인한 사용자 id. 로그인 전이면 null */
  userId(): Promise<string | null>;
  /** 내 작품들의 번호표 목록(내용 없이) */
  heads(): Promise<RemoteHead[]>;
  fetch(ids: string[]): Promise<RemoteRow[]>;
  /** expected: 마지막으로 본 번호표. 서버가 그 사이 바뀌었으면 ok:false */
  save(project: Project, expected: number): Promise<SaveResult>;
  remove(id: string, expected: number): Promise<SaveResult>;
  /** 다른 기기에서 바뀌면 알려준다(선택). 해제 함수를 돌려준다. */
  watch?(userId: string, onChange: () => void): () => void;
}
