import { batchUploadCollection } from './firestoreApi';

/**
 * 폴백 컬렉션(약제/카테고리/계열)이 DB에서 비어 있을 때(=시드를 화면에 띄우는 중)
 * 단일 문서만 저장하면 나머지 시드가 통째로 사라진다.
 * 그래서 첫 쓰기 전에 현재 화면에 떠 있는 전체 목록을 batch로 한 번에 올려
 * 컬렉션을 완전체로 만든다. (isEmpty=false면 아무것도 안 함)
 */
export async function ensureMaterialized<T extends { id: string }>(
  name: string,
  fullList: T[],
  isEmpty: boolean,
): Promise<void> {
  if (isEmpty) await batchUploadCollection(name, fullList);
}
