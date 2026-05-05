import { useMemo, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import type { MedCategory, Medication } from '../../types';

const CAT_ALL = '__all__';

interface MedSelectorProps {
  open: boolean;
  slotIndex: number; // 0..4
  currentMedId: string | null;
  medications: Medication[];
  categories: MedCategory[];
  onClose: () => void;
  onPick: (slotIndex: number, medId: string) => void;
  onClear: (slotIndex: number) => void;
}

export default function MedSelector({
  open,
  slotIndex,
  currentMedId,
  medications,
  categories,
  onClose,
  onPick,
  onClear,
}: MedSelectorProps) {
  const [step, setStep] = useState<'category' | 'meds'>('category');
  const [selectedCat, setSelectedCat] = useState<string>(CAT_ALL);

  const sortedCats = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories],
  );

  const filteredMeds = useMemo(() => {
    const list =
      selectedCat === CAT_ALL
        ? medications
        : medications.filter((m) => m.categoryId === selectedCat);
    return [...list].sort((a, b) => a.order - b.order);
  }, [medications, selectedCat]);

  if (!open) return null;

  const slotLabel = slotIndex < 3 ? `급여 ${slotIndex + 1}` : `본인부담 ${slotIndex - 2}`;

  const handleCatPick = (catId: string) => {
    setSelectedCat(catId);
    setStep('meds');
  };

  const handleClose = () => {
    setStep('category');
    setSelectedCat(CAT_ALL);
    onClose();
  };

  const handleMedPick = (medId: string) => {
    onPick(slotIndex, medId);
    setStep('category');
    setSelectedCat(CAT_ALL);
  };

  const handleClear = () => {
    onClear(slotIndex);
    setStep('category');
    setSelectedCat(CAT_ALL);
  };

  const catName =
    selectedCat === CAT_ALL
      ? '전체 약제'
      : categories.find((c) => c.id === selectedCat)?.name ?? '';

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-mobile rounded-t-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            {step === 'meds' && (
              <button
                type="button"
                onClick={() => setStep('category')}
                aria-label="뒤로"
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <p className="text-[11px] text-gray-500">{slotLabel}</p>
              <h2 className="text-sm font-semibold text-gray-900">
                {step === 'category' ? '카테고리 선택' : catName}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="닫기"
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-3">
          {step === 'category' ? (
            <ul className="flex flex-col gap-2">
              <li>
                <button
                  type="button"
                  onClick={() => handleCatPick(CAT_ALL)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 hover:border-indigo-300 hover:bg-indigo-50"
                >
                  전체 약제 보기
                </button>
              </li>
              {sortedCats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handleCatPick(c.id)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {filteredMeds.length === 0 ? (
                <li className="py-8 text-center text-sm text-gray-400">
                  해당 카테고리에 약제가 없습니다.
                </li>
              ) : (
                filteredMeds.map((m) => {
                  const isCurrent = m.id === currentMedId;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => handleMedPick(m.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                          isCurrent
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'
                        }`}
                      >
                        <span className="truncate font-medium text-gray-900">{m.name}</span>
                        {m.effect > 0 && (
                          <span className="shrink-0 text-xs text-gray-500">
                            HbA1c −{m.effect.toFixed(1)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>

        {currentMedId && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
            <button
              type="button"
              onClick={handleClear}
              className="w-full rounded-lg border border-red-200 bg-white py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              슬롯 비우기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
