export const count = (s: string) => [...s].length;
export const countNoSpace = (s: string) => [...s.replace(/\s/g, '')].length;
export const pad = (n: number) => String(n).padStart(2, '0');
export const fmt = (n: number) => n.toLocaleString('ko-KR');

function hasBatchim(word: string): boolean | null {
  const c = word.trim().charCodeAt(word.trim().length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  return null;
}

/** 받침에 따라 조사를 고른다. 한글이 아니면 '을(를)' 식으로 둘 다. */
export function josa(word: string, pair: '을/를' | '이/가' | '은/는' | '과/와' | '으로/로') {
  const [a, b] = pair.split('/');
  const last = word.trim().charCodeAt(word.trim().length - 1);
  if (pair === '으로/로' && last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 === 8) return b; // ㄹ 받침
  const has = hasBatchim(word);
  return has === null ? `${a}(${b})` : has ? a : b;
}

export const quote = (title: string, fallback = '제목 없는 씬') => `‘${title.trim() || fallback}’`;

export function when(iso: string) {
  const d = new Date(iso), diff = Date.now() - d.getTime();
  if (diff < 60e3) return '방금';
  if (diff < 3600e3) return `${Math.floor(diff / 60e3)}분 전`;
  if (diff < 864e5 && new Date().getDate() === d.getDate()) return `${Math.floor(diff / 3600e3)}시간 전`;
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
