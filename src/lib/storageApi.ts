import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { initFirebase, isStorageConfigured, ensureAnonymousAuth } from './firebase';

export async function uploadFile(
  path: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error('Firebase Storage가 설정되지 않았습니다. .env에 VITE_FIREBASE_STORAGE_BUCKET을 추가하거나 GitHub Secrets에 등록하세요.');
  }
  await ensureAnonymousAuth();
  const { app } = initFirebase();
  if (!app) throw new Error('Firebase 초기화 실패');

  const storage = getStorage(app);
  const storageRef = ref(storage, path);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress) {
          onProgress((snap.bytesTransferred / snap.totalBytes) * 100);
        }
      },
      (err: unknown) => {
        const code = (err as { code?: string }).code ?? '';
        let msg = '업로드 실패';
        if (code === 'storage/unauthorized') msg = '업로드 권한 없음 — Firebase Storage 보안 규칙을 확인하세요.';
        else if (code === 'storage/unauthenticated') msg = '인증 필요 — 페이지를 새로고침 후 다시 시도하세요.';
        else if (code === 'storage/canceled') msg = '업로드가 취소되었습니다.';
        else if (code) msg = `업로드 오류 (${code})`;
        reject(new Error(msg));
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}
