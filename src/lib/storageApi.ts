import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { initFirebase, isFirebaseConfigured } from './firebase';

export async function uploadFile(
  path: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase가 설정되지 않아 이미지를 업로드할 수 없습니다.');
  }
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
      reject,
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
