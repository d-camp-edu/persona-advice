import { useRef, useState } from 'react';
import { Upload, Loader2, X, Link2 } from 'lucide-react';
import { uploadFile } from '../../lib/storageApi';
import { isStorageConfigured } from '../../lib/firebase';
import { fileToDataUrl } from '../../lib/imageResize';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  storagePath: string;
  label?: string;
  previewSize?: 'sm' | 'md';
  /** 축소 시 긴 변 최대 픽셀 (기본 1024). 로고·아이콘 등 작은 이미지엔 512 권장. */
  maxDim?: number;
}

export default function ImageUploader({
  value,
  onChange,
  storagePath,
  label = '이미지',
  previewSize = 'md',
  maxDim,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const storageReady = isStorageConfigured();

  const handleFile = async (file: File) => {
    setError('');
    setNote('');
    setUploading(true);
    setProgress(0);
    try {
      // 1) Firebase Storage가 구성돼 있으면 우선 업로드 시도.
      if (storageReady) {
        try {
          const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
          const url = await uploadFile(`${storagePath}.${ext}`, file, setProgress);
          onChange(url);
          return;
        } catch (e) {
          // 업로드(권한/네트워크) 실패 → data URL 로 폴백. 사용자에겐 조용히 성공 처리.
          console.warn('[ImageUploader] storage upload failed, falling back to data URL', e);
          setNote('Storage 업로드 실패 → 이미지에 직접 저장했습니다.');
        }
      }
      // 2) 미구성 또는 업로드 실패 → 브라우저에서 축소해 data URL 로 저장.
      const dataUrl = await fileToDataUrl(file, maxDim);
      onChange(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 처리 실패');
    } finally {
      setUploading(false);
    }
  };

  const previewClass =
    previewSize === 'sm' ? 'h-14 w-14 rounded-lg' : 'h-24 w-24 rounded-xl';

  return (
    <div>
      <label className="mb-1 block text-xs text-gray-500">{label}</label>

      <div className="flex items-start gap-3">
        {/* Preview */}
        <div
          className={`${previewClass} flex flex-shrink-0 items-center justify-center overflow-hidden border border-gray-200 bg-gray-50`}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <Upload size={18} className="text-gray-300" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="mb-1.5 flex items-center gap-1.5 rounded border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {progress > 0 ? `${Math.round(progress)}% 업로드 중…` : '처리 중…'}
              </>
            ) : (
              <>
                <Upload size={12} />
                파일 선택
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
              >
                <X size={11} />
                이미지 제거
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowUrl((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600"
            >
              <Link2 size={11} />
              URL 직접 입력
            </button>
          </div>

          {showUrl && (
            <input
              type="text"
              className="mt-1.5 w-full rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://..."
            />
          )}

          {!storageReady && (
            <p className="mt-1 text-[10px] text-gray-400">
              Storage 미구성 — 이미지를 축소해 데이터에 직접 저장합니다.
            </p>
          )}
          {note && <p className="mt-1 text-[10px] text-amber-600">{note}</p>}
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
