import { useState } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import { useSessionStore } from '../store/useSessionStore';
import type { SurveyQuestion } from '../types';

export default function SurveyScreen() {
  const questions = useDataStore((s) => s.surveyQuestions);
  const doctorName = useSessionStore((s) => s.doctorName);
  const completeSurvey = useSessionStore((s) => s.completeSurvey);
  const settings = useDataStore((s) => s.settings);

  const sorted = [...questions].sort((a, b) => a.order - b.order);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const current = sorted[step];
  const isLast = step === sorted.length - 1;
  const progress = ((step + 1) / sorted.length) * 100;

  const getAnswer = (q: SurveyQuestion): string | string[] => {
    if (q.type === 'multi') return (answers[q.id] as string[]) ?? [];
    return (answers[q.id] as string) ?? '';
  };

  const setAnswer = (q: SurveyQuestion, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
  };

  const toggleMulti = (q: SurveyQuestion, option: string) => {
    const cur = (answers[q.id] as string[]) ?? [];
    const next = cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option];
    setAnswer(q, next);
  };

  const canProceed = () => {
    if (!current) return true;
    if (!current.required) return true;
    const ans = getAnswer(current);
    if (current.type === 'multi') return (ans as string[]).length > 0;
    return String(ans).trim().length > 0;
  };

  const handleNext = async () => {
    if (!canProceed()) return;
    if (isLast) {
      setSubmitting(true);
      await completeSurvey(answers);
      setSubmitting(false);
    } else {
      setStep((s) => s + 1);
    }
  };

  if (sorted.length === 0) {
    void completeSurvey({});
    return null;
  }

  return (
    <div
      className="relative flex h-full w-full flex-col"
      style={{
        background: `linear-gradient(135deg, ${settings.loginBgStart}, ${settings.loginBgEnd})`,
      }}
    >
      {/* Header */}
      <div className="px-6 pt-10 pb-4">
        <p className="text-sm font-medium text-white/80 mb-1">{doctorName} 선생님</p>
        <h1 className="text-xl font-bold text-white">시연 전 간단한 질문입니다</h1>
      </div>

      {/* Progress bar */}
      <div className="mx-6 h-1.5 rounded-full bg-white/20 mb-6">
        <div
          className="h-full rounded-full bg-white transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-center text-xs text-white/60 -mt-4 mb-6">
        {step + 1} / {sorted.length}
      </p>

      {/* Question card */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {current && (
          <div className="rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur">
            <p className="mb-1 text-xs font-semibold text-indigo-500 uppercase tracking-wide">
              Q{step + 1}
              {current.required && <span className="ml-1 text-red-400">*</span>}
            </p>
            <p className="mb-5 text-base font-semibold text-gray-900 leading-snug">
              {current.text}
            </p>

            {/* Single choice */}
            {current.type === 'single' && (
              <div className="flex flex-col gap-2">
                {current.options.map((opt) => {
                  const selected = getAnswer(current) === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswer(current, opt)}
                      className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-all ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/50'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                            selected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                          }`}
                        >
                          {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                        </span>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Multi choice */}
            {current.type === 'multi' && (
              <div className="flex flex-col gap-2">
                {current.options.map((opt) => {
                  const selected = ((getAnswer(current) as string[]) ?? []).includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleMulti(current, opt)}
                      className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-all ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-200'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 ${
                            selected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                          }`}
                        >
                          {selected && (
                            <CheckCircle2 size={12} className="text-white" strokeWidth={3} />
                          )}
                        </span>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Text input */}
            {current.type === 'text' && (
              <textarea
                rows={4}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-indigo-400 resize-none"
                placeholder={current.required ? '답변을 입력해 주세요.' : '(선택 사항)'}
                value={(getAnswer(current) as string) ?? ''}
                onChange={(e) => setAnswer(current, e.target.value)}
              />
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 px-6 pb-8 pt-4">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-1.5 rounded-xl bg-white/20 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/30"
          >
            <ChevronLeft size={16} />
            이전
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleNext()}
          disabled={!canProceed() || submitting}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-semibold text-indigo-700 shadow-lg transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            '저장 중…'
          ) : isLast ? (
            <>
              시연 시작하기
              <CheckCircle2 size={16} />
            </>
          ) : (
            <>
              다음
              <ChevronRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
