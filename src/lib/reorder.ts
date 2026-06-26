/**
 * 드래그 정렬 유틸 — 리스트에서 dragId 항목을 targetId 위치로 이동한 새 배열을 반환.
 */
export function moveItem<T extends { id: string }>(
  list: T[],
  dragId: string,
  targetId: string,
): T[] {
  if (dragId === targetId) return list;
  const from = list.findIndex((x) => x.id === dragId);
  const to = list.findIndex((x) => x.id === targetId);
  if (from < 0 || to < 0) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
