import { newChapter, newProject, newScene } from './project';
import type { Project, Stage } from './types';

type Row = [title: string, summary: string, pov: string, place: string, time: string, stage: Stage, body?: string];

const CHAPTERS: [string, Row[]][] = [
  ['도착', [
    ['섬으로 가는 배', '마지막 배에 오른 윤서. 선장은 등대가 십 년째 꺼져 있다고 말한다.', '윤서', '바다', '첫날 오후', 'done',
      '배는 해 질 무렵에야 섬에 닿았다. 갑판에 남은 승객은 윤서 한 사람뿐이었다.\n\n“저 등대, 불 안 들어온 지 십 년 됐어요.” 선장이 밧줄을 던지며 말했다.'],
    ['꺼진 등대', '문은 안에서 잠겨 있다. 창문 너머로 누군가 불을 켰던 흔적.', '윤서', '등대', '첫날 해 질 녘', 'revise',
      '등대 문은 안에서 잠겨 있었다. 손잡이에는 녹이 슬었는데, 문틈의 먼지만은 누가 쓸어낸 듯 깨끗했다.\n\n윤서는 창문에 이마를 댔다. 탁자 위에 타다 만 초 하나가 서 있었다.'],
    ['민박집 주인', '주인은 등대 이야기를 피한다. 벽에 걸린 사진 한 장.', '윤서, 해진', '민박', '첫날 저녁', 'draft',
      '주인은 찻잔을 내려놓으며 창밖을 보았다. 등대 얘기를 꺼내자 그녀의 손끝이 잠시 멈췄다.\n\n“그 등대는 오래전에 문을 닫았어요. 이제는 아무도 올라가지 않죠.”\n\n윤서는 대답 대신 벽을 보았다. 액자 속 사진에는 등대 앞에 선 두 사람이 있었다. 한 사람은 분명 젊은 시절의 주인이었다.'],
    ['첫날 밤', '자정, 바다 쪽에서 세 번 깜빡이는 빛.', '윤서', '민박', '첫날 자정', 'draft'],
  ]],
  ['흔적', [
    ['사진 속 얼굴', '액자 뒤에 적힌 이름. 윤서는 그 이름을 어디선가 들은 적이 있다.', '윤서, 해진', '민박', '둘째 날 아침', 'draft'],
    ['선장의 일지', '마지막 페이지만 찢겨 나갔다. 날짜는 등대가 꺼진 날.', '선장', '배', '둘째 날', 'idea'],
    ['잠긴 계단', '열쇠는 맞지 않는다. 계단 위에서 발소리가 멈춘다.', '윤서', '등대', '둘째 날 밤', 'idea'],
  ]],
  ['불빛', [
    ['등대지기', '꼭대기 방의 불은 켜져 있었다. 그리고 그는 기다리고 있었다.', '윤서, 등대지기', '등대', '셋째 날 새벽', 'idea'],
  ]],
];

export function sampleProject(): Project {
  const chapters = CHAPTERS.map(([title]) => newChapter(title));
  const scenes = CHAPTERS.flatMap(([, rows], i) =>
    rows.map(([title, summary, pov, place, time, stage, body = '']) => newScene({ title, summary, pov, place, time, stage, body, chapterId: chapters[i].id })),
  );
  return newProject({ title: '등대의 밤', subtitle: '예시 작품', chapters, scenes });
}
