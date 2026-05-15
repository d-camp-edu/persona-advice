import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import type { SurveyQuestion } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

function newQuestion(): SurveyQuestion {
  return {
    id: `sq_${Date.now().toString(36)}`,
    order: 99,
    text: '새 질문을 입력하세요.',
    type: 'single',
    options: ['선택지 1', '선택지 2'],
    required: true,
  };
}

function QuestionEditor({
  question,
  onSave,
  onDelete,
}: {
  question: SurveyQuestion;
  onSave: (q: SurveyQuestion) => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<SurveyQuestion>(() => structuredClone(question));
  const [saving, setSaving] = useState(false);
  const [newOption, setNewOption] = useState('');

  const set = <K extends keyof SurveyQuestion>(k: K, v: SurveyQuestion[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  const addOption = () => {
    const val = newOption.trim();
    if (!val) return;
    set('options', [...draft.options, val]);
    setNewOption('');
  };

  const removeOption = (i: number) => {
    set('options', draft.options.filter((_, idx) => idx !== i));
  };

  const updateOption = (i: number, val: string) => {
    const next = [...draft.options];
    next[i] = val;
    set('options', next);
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
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
          checked={draft.required}
          onChange={(e) => set('required', e.target.checked)}
          className="h-3.5 w-3.5"
        />
        필수 질문
      </label>

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
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex-1 rounded bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const sorted = [...questions].sort((a, b) => a.order - b.order);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const handleSave = async (q: SurveyQuestion) => {
    const { id, ...rest } = q;
    await saveDoc('surveyQuestions', id, rest as unknown as Record<string, unknown>);
    showFlash('저장됨');
    setExpanded(null);
  };

  const handleDelete = async (id: string) => {
    await removeDoc('surveyQuestions', id);
    setExpanded(null);
  };

  const handleAdd = async () => {
    const q = newQuestion();
    const { id, ...rest } = q;
    await saveDoc('surveyQuestions', id, rest as unknown as Record<string, unknown>);
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

      {flash && <p className="mb-2 text-sm font-medium text-indigo-600">{flash}</p>}

      {sorted.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm text-gray-400">등록된 서베이 질문이 없습니다.</p>
          <p className="mt-1 text-xs text-gray-400">질문이 없으면 로그인 후 서베이를 건너뜁니다.</p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        {sorted.map((q) => (
          <div key={q.id}>
            <button
              type="button"
              onClick={() => setExpanded(expanded === q.id ? null : q.id)}
              className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-600">
                  Q{q.order}
                </span>
                <span className="text-sm font-medium text-gray-900 truncate">{q.text}</span>
                <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {typeLabel[q.type]}
                </span>
                {q.required && (
                  <span className="flex-shrink-0 text-xs text-red-400">*필수</span>
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
                onSave={handleSave}
                onDelete={() => void handleDelete(q.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
