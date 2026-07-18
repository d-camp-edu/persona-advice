import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronLeft, Star, X } from 'lucide-react';
import type { MedCategory, Medication } from '../../types';

const CAT_ALL = '__all__';

interface MedSelectorProps {
  open: boolean;
  slotIndex: number; // 0..4
  currentMedId: string | null;
  medications: Medication[];
  categories: MedCategory[];
  currentEgfr: number;
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
  currentEgfr,
  onClose,
  onPick,
  onClear,
}: MedSelectorProps) {
  const [step, setStep] = useState<'category' | 'meds'>('category');
  const [selectedCat, setSelectedCat] = useState<string>(CAT_ALL);

  // 실제 약제가 1개 이상 매핑된 카테고리만, id 기준 중복 없이 노출한다.
  // (Firestore에 남은 옛 카테고리 문서나 약제 0개짜리 구분·중복 항목을 자동 제거)
  const sortedCats = useMemo(() => {
    const usedCatIds = new Set(medications.map((m) => m.categoryId));
    const seen = new Set<string>();
    return [...categories]
      .filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return usedCatIds.has(c.id);
      })
      .sort((a, b) => a.order - b.order);
  }, [categories, medications]);

  const catOrder = useMemo(
    () => new Map(categories.map((c) => [c.id, c.order])),
    [categories],
  );

  const filteredMeds = useMemo(() => {
    const list =
      selectedCat === CAT_ALL
        ? medications
        : medications.filter((m) => m.categoryId === selectedCat);
    // 아사(자사=종근당) 제품 우선 → 카테고리 순서(단일제·2제·메폴민2제·3제·주사제…)
    // → 개별 order. order 필드는 카테고리 내에서 계열(DPP-4i·SGLT-2i·TZD) 순으로
    // 이미 정렬돼 있으므로 그대로 따르면 요청한 계열 순서가 유지된다.
    return [...list].sort((a, b) => {
      const asa = Number(!!b.isAsaProduct) - Number(!!a.isAsaProduct);
      if (asa !== 0) return asa;
      const cat = (catOrder.get(a.categoryId) ?? 999) - (catOrder.get(b.categoryId) ?? 999);
      if (cat !== 0) return cat;
      return a.order - b.order;
    });
  }, [medications, selectedCat, catOrder]);

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

  return createPortal(
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
                  const egfrWarn =
                    m.egfrLimit > 0 && currentEgfr > 0 && currentEgfr < m.egfrLimit;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => handleMedPick(m.id)}
                        className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                          isCurrent
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1">
                            {m.isAsaProduct && (
                              <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                            )}
                            <span className="truncate font-medium text-gray-900">{m.name}</span>
                          </span>
                          {m.effect > 0 && (
                            <span className="shrink-0 text-xs text-gray-500">
                              HbA1c −{m.effect.toFixed(1)}
                            </span>
                          )}
                        </span>
                        {egfrWarn && (
                          <span className="flex items-center gap-1 text-[11px] text-amber-700">
                            <AlertTriangle size={12} />
                            eGFR 하한 {m.egfrLimit} (현재 {currentEgfr.toFixed(0)}) — 신중 처방
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
    </div>,
    document.body,
  );
}
