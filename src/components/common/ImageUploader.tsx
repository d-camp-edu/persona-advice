import { useRef, useState } from 'react';
import { Upload, Loader2, X } from 'lucide-react';
import { uploadFile } from '../../lib/storageApi';
import { isFirebaseConfigured } from '../../lib/firebase';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  storagePath: string;
  label?: string;
  previewSize?: 'sm' | 'md';
}

export default function ImageUploader({
  value,
  onChange,
  storagePath,
  label = '이미지',
  previewSize = 'md',
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const firebaseReady = isFirebaseConfigured();

  const handleFile = async (file: File) => {
    setError('');
    setUploading(true);
    setProgress(0);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const url = await uploadFile(`${storagePath}.${ext}`, file, setProgress);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  const previewClass =
    previewSize === 'sm'
      ? 'h-14 w-14 rounded-lg'
      : 'h-24 w-24 rounded-xl';

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
          {firebaseReady ? (
            <>
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
                    {Math.round(progress)}% 업로드 중…
                  </>
                ) : (
                  <>
                    <Upload size={12} />
                    파일 선택
                  </>
                )}
              </button>
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
              {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            </>
          ) : (
            <div>
              <p className="mb-1 text-[10px] text-amber-600">Firebase 미구성 — URL 직접 입력</p>
              <input
                type="text"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
