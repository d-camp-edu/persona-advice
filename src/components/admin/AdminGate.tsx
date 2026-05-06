import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAdminStore } from '../../store/useAdminStore';
import { useDataStore } from '../../store/useDataStore';
import { useSessionStore } from '../../store/useSessionStore';

export default function AdminGate() {
  const [pw, setPw] = useState('');
  const unlock = useAdminStore((s) => s.unlock);
  const authError = useAdminStore((s) => s.authError);
  const adminPassword = useDataStore((s) => s.settings.adminPassword);
  const exitAdmin = useSessionStore((s) => s.exitAdmin);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    unlock(pw, adminPassword);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center bg-gray-50 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
      >
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Lock className="h-8 w-8 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Admin 콘솔</h1>
          <p className="text-sm text-gray-500">관리자 비밀번호를 입력하세요</p>
        </div>

        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="비밀번호"
          autoFocus
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />

        {authError && <p className="mb-3 text-xs text-red-500">{authError}</p>}

        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800"
        >
          확인
        </button>
        <button
          type="button"
          onClick={exitAdmin}
          className="mt-3 w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          취소
        </button>
      </form>
    </div>
  );
}
