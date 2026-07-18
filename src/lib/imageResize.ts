// 이미지 파일을 브라우저에서 축소해 data URL(base64) 로 변환한다.
// Firebase Storage(버킷·보안규칙·CORS)에 의존하지 않고도 이미지를 저장·표시하기 위한
// 폴백 경로다. 결과 data URL 은 Firestore 문서에 그대로 저장되므로 1MB 문서 한도 아래로
// 확실히 떨어지도록 긴 변을 maxDim 으로 줄이고 필요 시 JPEG 로 재인코딩한다.

const DEFAULT_MAX_DIM = 1024;
const DEFAULT_QUALITY = 0.82;
// data URL 문자열이 이 길이를 넘으면 (≈0.8MB) PNG 라도 JPEG 로 재인코딩해 문서 한도를 지킨다.
const MAX_DATAURL_LEN = 800_000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
    img.src = src;
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    fr.readAsDataURL(file);
  });
}

/**
 * 이미지 파일 → (축소된) data URL. 캔버스를 쓸 수 없는 환경이면 원본 data URL 로 폴백한다.
 * - 긴 변이 maxDim 을 넘으면 비율을 유지하며 축소한다.
 * - 투명도가 필요한 PNG 는 되도록 PNG 로 유지하되, 너무 크면 JPEG 로 재인코딩한다.
 */
export async function fileToDataUrl(
  file: File,
  maxDim: number = DEFAULT_MAX_DIM,
  quality: number = DEFAULT_QUALITY,
): Promise<string> {
  const original = await readAsDataUrl(file);
  try {
    const img = await loadImage(original);
    const { width, height } = img;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, w, h);

    const isPng = file.type === 'image/png';
    let out = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);
    // PNG 가 너무 크면(투명도 불필요한 큰 이미지) JPEG 로 재인코딩해 문서 한도 확보.
    if (out.length > MAX_DATAURL_LEN) {
      out = canvas.toDataURL('image/jpeg', quality);
    }
    // 그래도 크면 한 단계 더 축소해 재시도.
    if (out.length > MAX_DATAURL_LEN && Math.max(w, h) > 640) {
      return fileToDataUrl(file, 640, 0.75);
    }
    return out;
  } catch {
    // 캔버스/디코딩 실패 시 원본 data URL 그대로 반환(적어도 표시는 된다).
    return original;
  }
}
