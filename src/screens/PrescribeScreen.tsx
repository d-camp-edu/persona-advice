import { useMemo, useState } from 'react';
import { ArrowLeft, FileText, Pill } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import { useSessionStore } from '../store/useSessionStore';
import PatientInfoCard from '../components/patient/PatientInfoCard';
import PatientChart from '../components/patient/PatientChart';
import DiagCodeToggle from '../components/prescribe/DiagCodeToggle';
import SlotList from '../components/prescribe/SlotList';
import MedSelector from '../components/prescribe/MedSelector';

export default function PrescribeScreen() {
  const patients = useDataStore((s) => s.patients);
  const medications = useDataStore((s) => s.medications);
  const categories = useDataStore((s) => s.medCategories);
  const settings = useDataStore((s) => s.settings);

  const currentPatientId = useSessionStore((s) => s.currentPatientId);
  const rxPhase = useSessionStore((s) => s.rxPhase);
  const setRxPhase = useSessionStore((s) => s.setRxPhase);
  const slots = useSessionStore((s) => s.slots);
  const diagCodes = useSessionStore((s) => s.diagCodes);
  const setSlot = useSessionStore((s) => s.setSlot);
  const clearSlot = useSessionStore((s) => s.clearSlot);
  const toggleDiag = useSessionStore((s) => s.toggleDiag);
  const resetToSelect = useSessionStore((s) => s.resetToSelect);

  const [selectorSlot, setSelectorSlot] = useState<number | null>(null);

  const patient = useMemo(
    () => patients.find((p) => p.id === currentPatientId) ?? null,
    [patients, currentPatientId],
  );

  if (!patient) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">선택된 환자가 없습니다.</p>
        <button
          type="button"
          onClick={resetToSelect}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          환자 선택으로 돌아가기
        </button>
      </div>
    );
  }

  // M4 단계에서는 시뮬레이션 결과가 아직 없으므로 currentHba1c는 base와 동일.
  const currentHba1c = patient.initialHba1c;

  const filledSlotCount = slots.filter((id) => id != null).length;
  const filledDrugSlotCount = slots
    .filter((id): id is string => id != null)
    .map((id) => medications.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m && !m.isNotDrug).length;
  const needsDiag = filledDrugSlotCount > 0;
  const canConfirm = filledSlotCount > 0 && (!needsDiag || diagCodes.length > 0);

  const handleCancel = () => {
    for (let i = 0; i < 5; i += 1) clearSlot(i);
    diagCodes.forEach((c) => toggleDiag(c));
    setRxPhase('menu');
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    setRxPhase('result');
  };

  return (
    <div className="flex h-full w-full flex-col bg-gray-50">
      <header className="flex items-center justify-between gap-2 border-b border-gray-100 bg-white px-4 py-3">
        <button
          type="button"
          onClick={resetToSelect}
          aria-label="환자 선택으로"
          className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 truncate text-sm font-semibold text-gray-700">
          처방 시뮬레이션
        </h1>
      </header>

      <div className="border-b border-gray-100 bg-white px-4 py-3">
        <PatientInfoCard
          patient={patient}
          currentHba1c={currentHba1c}
          comorbidities={settings.comorbidities}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {rxPhase === 'menu' && (
          <MenuPhase
            onPrescribe={() => setRxPhase('prescribe')}
            onChart={() => setRxPhase('chart')}
          />
        )}

        {rxPhase === 'chart' && (
          <ChartPhaseView
            onBack={() => setRxPhase('menu')}
            content={
              <PatientChart
                patient={patient}
                currentHba1c={currentHba1c}
                medications={medications}
              />
            }
          />
        )}

        {rxPhase === 'prescribe' && (
          <PrescribePhaseView
            slots={slots}
            medications={medications}
            diagCodes={diagCodes}
            onToggleDiag={toggleDiag}
            onChangeSlot={(idx) => setSelectorSlot(idx)}
            onCancel={handleCancel}
            onConfirm={handleConfirm}
            canConfirm={canConfirm}
            needsDiag={needsDiag}
          />
        )}

        {rxPhase === 'result' && (
          <ResultPhaseView
            onBack={() => setRxPhase('menu')}
            onOpenReport={() => {
              // M5/M6에서 실제 결과 리포트로 이동. 현재는 placeholder.
              setRxPhase('menu');
            }}
          />
        )}
      </div>

      <MedSelector
        open={selectorSlot != null}
        slotIndex={selectorSlot ?? 0}
        currentMedId={selectorSlot != null ? slots[selectorSlot] : null}
        medications={medications}
        categories={categories}
        onClose={() => setSelectorSlot(null)}
        onPick={(idx, medId) => {
          setSlot(idx, medId);
          setSelectorSlot(null);
        }}
        onClear={(idx) => {
          clearSlot(idx);
          setSelectorSlot(null);
        }}
      />
    </div>
  );
}

function MenuPhase({ onPrescribe, onChart }: { onPrescribe: () => void; onChart: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onPrescribe}
        className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 py-5 text-base font-semibold text-white shadow-md transition active:scale-[0.99] hover:bg-indigo-600"
      >
        <Pill size={20} />
        처방 조합
      </button>
      <button
        type="button"
        onClick={onChart}
        className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-5 text-base font-semibold text-gray-800 shadow-sm transition active:scale-[0.99] hover:bg-gray-50"
      >
        <FileText size={20} />
        차트 보기
      </button>
    </div>
  );
}

function ChartPhaseView({ content, onBack }: { content: React.ReactNode; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">{content}</div>
      <button
        type="button"
        onClick={onBack}
        className="self-start rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        ← 메뉴로
      </button>
    </div>
  );
}

function PrescribePhaseView({
  slots,
  medications,
  diagCodes,
  onToggleDiag,
  onChangeSlot,
  onCancel,
  onConfirm,
  canConfirm,
  needsDiag,
}: {
  slots: (string | null)[];
  medications: ReturnType<typeof useDataStore.getState>['medications'];
  diagCodes: string[];
  onToggleDiag: (code: string) => void;
  onChangeSlot: (idx: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
  needsDiag: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h2 className="mb-2 text-xs font-semibold text-gray-600">상병코드 (필수)</h2>
        <DiagCodeToggle selected={diagCodes} onToggle={onToggleDiag} />
        {needsDiag && diagCodes.length === 0 && (
          <p className="mt-1.5 text-[11px] text-red-500">최소 1개 이상의 상병코드를 선택하세요.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold text-gray-600">처방 약제 (5슬롯)</h2>
        <SlotList slots={slots} medications={medications} onChangeSlot={onChangeSlot} />
      </section>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-gray-100 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="flex-[2] rounded-lg bg-indigo-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          처방 확정 →
        </button>
      </div>
    </div>
  );
}

function ResultPhaseView({
  onBack,
  onOpenReport,
}: {
  onBack: () => void;
  onOpenReport: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
        처방이 확정되었습니다.
        <br />
        <span className="text-xs text-indigo-700">
          (실제 결과 계산은 M5에서, 결과 리포트 화면은 M6에서 연결됩니다.)
        </span>
      </div>
      <button
        type="button"
        onClick={onOpenReport}
        className="rounded-lg bg-indigo-500 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600"
      >
        결과 리포트 보기 →
      </button>
      <button
        type="button"
        onClick={onBack}
        className="self-start rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        ← 메뉴로
      </button>
    </div>
  );
}
