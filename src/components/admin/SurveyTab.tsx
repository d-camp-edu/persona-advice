import { useMemo, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, EyeOff } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import { useDraftAutoSave, SaveStatusBadge } from './useDraftAutoSave';
import { applyProductScope } from '../../lib/surveyScope';
import type { Product, SurveyQuestion } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

function newQuestion(): SurveyQuestion {
  return {
    id: `sq_${Date.now().toString(36)}`,
    order: 99,
    text: '새 질문을 입력하세요.',
    type: 'single',
    options: ['선택지 1', '선택지 2'],
    required: false,
    surveyOnly: false,
    productScope: [],
  };
}

function QuestionEditor({
  question,
  comorbNames,
  products,
  onSave,
  onDelete,
}: {
  question: SurveyQuestion;
  comorbNames: string[];
  products: Product[];
  onSave: (q: SurveyQuestion) => void | Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<SurveyQuestion>(() => structuredClone(question));
  const [newOption, setNewOption] = useState('');
  // 체크만 하고 저장을 안 눌러 설정이 유실되던 문제 → 자동 저장.
  const { status, saveNow } = useDraftAutoSave(draft, onSave);

  const set = <K extends keyof SurveyQuestion>(k: K, v: SurveyQuestion[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const addOption = () => {
    const val = newOption.trim();
    if (!val) return;
    set('options', [...draft.options, val]);
    setNewOption('');
  };

  const removeOption = (i: number) => {
    set('options', draft.options.filter((_, idx) => idx !== i));
  };

  const toggleScope = (name: string) => {
    const cur = draft.comorbidityScope ?? [];
    set(
      'comorbidityScope',
      cur.includes(name) ? cur.filter((c) => c !== name) : [...cur, name],
    );
  };

  const toggleProduct = (id: string) => {
    const cur = draft.productScope ?? [];
    set('productScope', cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]);
  };

  const updateOption = (i: number, val: string) => {
    const next = [...draft.options];
    next[i] = val;
    set('options', next);
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
      <div className="mb-2 flex items-center justify-end">
        <SaveStatusBadge status={status} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 mb-3">
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">순서</label>
          <input
            type="number"
            className={inp}
            value={draft.order}
            onChange={(e) => set('order', +e.target.value)}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">유형</label>
          <select
            className={inp}
            value={draft.type}
            onChange={(e) => set('type', e.target.value as SurveyQuestion['type'])}
          >
            <option value="single">단일 선택</option>
            <option value="multi">복수 선택</option>
            <option value="text">주관식</option>
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-0.5 block text-xs text-gray-500">질문 내용</label>
        <textarea
          rows={2}
          className={`${inp} resize-none`}
          value={draft.text}
          onChange={(e) => set('text', e.target.value)}
        />
      </div>

      <label className="mb-1 flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
        <input
          type="checkbox"
          checked={!!draft.required}
          onChange={(e) => set('required', e.target.checked)}
          className="h-3.5 w-3.5"
        />
        필수 응답 (선택·복수형 질문에서 응답해야 다음으로 진행 · 주관식은 제외)
      </label>

      <label className="mb-1 flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
        <input
          type="checkbox"
          checked={!!draft.surveyOnly}
          onChange={(e) => set('surveyOnly', e.target.checked)}
          className="h-3.5 w-3.5"
        />
        서베이만 진행 전용 (환자 시연 중엔 표시 안 함, '서베이만 진행'에서만 노출)
      </label>

      {/* 노출 품목 (타겟처 배포) */}
      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold text-gray-600">노출 품목 (타겟처 담당자)</p>
        <p className="mb-2 text-[11px] leading-snug text-gray-400">
          선택한 품목의 담당자에게만 이 질문을 노출합니다. 아무것도 선택하지 않으면
          <strong className="text-gray-500"> 공통</strong> 질문입니다.
          <br />
          <strong className="text-amber-600">
            ⚠️ 어떤 품목에 지정된 질문이 하나라도 있으면, 그 품목 담당자에게는 공통 질문이 노출되지
            않습니다.
          </strong>
          {' '}
          품목별로 공통 질문도 보여주려면 그 품목을 공통 질문에도 함께 체크하세요. '직접 입력'
          로그인은 품목이 없어 항상 공통 질문만 봅니다.
        </p>
        {products.length === 0 ? (
          <p className="text-[11px] text-gray-400">
            등록된 품목이 없습니다. ('진행률' 탭의 품목 관리에서 추가)
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {products.map((p) => {
              const active = (draft.productScope ?? []).includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProduct(p.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    active
                      ? 'border-sky-500 bg-sky-50 font-semibold text-sky-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-sky-200'
                  }`}
                >
                  {p.name}
                  {!p.active && <span className="ml-1 text-[10px] text-gray-400">(비활성)</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 노출 환자구분(공병증) */}
      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold text-gray-600">노출 환자구분 (공병증)</p>
        <p className="mb-2 text-[11px] leading-snug text-gray-400">
          선택한 공병증을 가진 환자에게만 이 질문을 노출합니다. 아무것도 선택하지 않으면
          <strong className="text-gray-500"> 모든 환자에게 공통</strong>으로 노출됩니다.
        </p>
        {comorbNames.length === 0 ? (
          <p className="text-[11px] text-gray-400">등록된 환자구분이 없습니다. (설정 탭에서 추가)</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {comorbNames.map((name) => {
              const active = (draft.comorbidityScope ?? []).includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleScope(name)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    active
                      ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-200'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Options (not shown for text type) */}
      {draft.type !== 'text' && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold text-gray-600">선택지</p>
          <div className="space-y-1.5 mb-2">
            {draft.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <GripVertical size={12} className="text-gray-300 flex-shrink-0" />
                <input
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-indigo-400"
              placeholder="새 선택지 입력 후 추가"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
            />
            <button
              type="button"
              onClick={addOption}
              className="flex items-center gap-1 rounded bg-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-300"
            >
              <Plus size={11} />
              추가
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void saveNow()}
          disabled={status === 'saving'}
          className="flex-1 rounded bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {status === 'saving' ? '저장 중…' : '지금 저장'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm('이 질문을 삭제하시겠습니까?')) onDelete();
          }}
          className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function SurveyTab() {
  const questions = useDataStore((s) => s.surveyQuestions);
  const comorbNames = useDataStore((s) => s.settings.comorbidities.map((c) => c.name));
  const allProducts = useDataStore((s) => s.products);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flash, setFlash] = useState('');
  // '이 품목 담당자가 실제로 보는 질문'을 확인하는 미리보기. '' = 미리보기 끔.
  const [previewProductId, setPreviewProductId] = useState('');

  const products = useMemo(
    () => [...allProducts].sort((a, b) => a.order - b.order),
    [allProducts],
  );
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;

  const sorted = useMemo(() => [...questions].sort((a, b) => a.order - b.order), [questions]);

  // 미리보기 품목에서 실제 노출되는 질문 id 집합.
  // 대체 규칙은 흐름(환자별 / 서베이만)마다 따로 판정되므로 두 흐름을 각각 계산해 합집합을 낸다.
  const visibleIds = useMemo(() => {
    if (!previewProductId) return null;
    const patientFlow = applyProductScope(
      questions.filter((q) => !q.surveyOnly),
      previewProductId,
    );
    const surveyOnlyFlow = applyProductScope(
      questions.filter((q) => q.surveyOnly),
      previewProductId,
    );
    return new Set([...patientFlow, ...surveyOnlyFlow].map((q) => q.id));
  }, [questions, previewProductId]);

  const hiddenCount = visibleIds ? sorted.filter((q) => !visibleIds.has(q.id)).length : 0;

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  // setDoc 은 문서를 통째로 덮어쓰고 Firestore 는 undefined 필드를 거부한다.
  // 손대지 않은 optional 필드가 undefined 로 들어오는 경로를 여기서 막는다.
  const toDocData = (q: SurveyQuestion): Record<string, unknown> => {
    const { id: _id, ...rest } = q;
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) data[k] = v;
    }
    data.productScope = q.productScope ?? [];
    return data;
  };

  const handleSave = async (q: SurveyQuestion) => {
    await saveDoc('surveyQuestions', q.id, toDocData(q));
  };

  const handleDelete = async (id: string) => {
    await removeDoc('surveyQuestions', id);
    setExpanded(null);
  };

  const handleAdd = async () => {
    const q = newQuestion();
    await saveDoc('surveyQuestions', q.id, toDocData(q));
    showFlash('질문이 추가되었습니다.');
    setExpanded(q.id);
  };

  const typeLabel: Record<SurveyQuestion['type'], string> = {
    single: '단일선택',
    multi: '복수선택',
    text: '주관식',
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">사전 서베이 질문 관리</h2>
          <p className="text-xs text-gray-500 mt-0.5">로그인 후 의사에게 표시되는 질문을 설정합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          새 질문
        </button>
      </div>

      {/* 품목별 미리보기 */}
      {products.length > 0 && (
        <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2.5">
          <label className="mb-1 block text-xs font-semibold text-sky-800">품목별 미리보기</label>
          <select
            className="w-full rounded border border-sky-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-sky-500"
            value={previewProductId}
            onChange={(e) => setPreviewProductId(e.target.value)}
          >
            <option value="">전체 질문 보기</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} 담당자가 보는 질문
              </option>
            ))}
          </select>
          {visibleIds && (
            <p className="mt-1.5 text-[11px] leading-snug text-sky-700">
              <strong>{productName(previewProductId)}</strong> 담당자에게 노출 {visibleIds.size}개
              {hiddenCount > 0 && ` · 미노출 ${hiddenCount}개 (아래 흐리게 표시)`}
            </p>
          )}
        </div>
      )}

      {flash && <p className="mb-2 text-sm font-medium text-indigo-600">{flash}</p>}

      {sorted.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm text-gray-400">등록된 서베이 질문이 없습니다.</p>
          <p className="mt-1 text-xs text-gray-400">질문이 없으면 로그인 후 서베이를 건너뜁니다.</p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        {sorted.map((q) => {
          const hidden = !!visibleIds && !visibleIds.has(q.id);
          const scopedProducts = q.productScope ?? [];
          return (
            <div key={q.id} className={hidden ? 'opacity-40' : undefined}>
              <button
                type="button"
                onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
              >
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="flex-shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-600">
                    Q{q.order}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate">{q.text}</span>
                  <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {typeLabel[q.type]}
                  </span>
                  {q.required && q.type !== 'text' && (
                    <span className="flex-shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-500">
                      필수
                    </span>
                  )}
                  {q.surveyOnly && (
                    <span className="flex-shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
                      서베이 전용
                    </span>
                  )}
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      scopedProducts.length > 0
                        ? 'bg-sky-50 text-sky-700'
                        : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    {scopedProducts.length > 0
                      ? scopedProducts.map(productName).join('·')
                      : '품목 공통'}
                  </span>
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      q.comorbidityScope && q.comorbidityScope.length > 0
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {q.comorbidityScope && q.comorbidityScope.length > 0
                      ? q.comorbidityScope.join('·')
                      : '공통'}
                  </span>
                  {hidden && (
                    <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                      <EyeOff size={10} />
                      이 품목 미노출
                    </span>
                  )}
                </div>
                {expanded === q.id ? (
                  <ChevronUp className="h-4 w-4 flex-shrink-0 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
                )}
              </button>
              {expanded === q.id && (
                <QuestionEditor
                  question={q}
                  comorbNames={comorbNames}
                  products={products}
                  onSave={handleSave}
                  onDelete={() => void handleDelete(q.id)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
