import { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc } from '../../lib/firestoreApi';
import { uploadSettings } from '../../data/seedRunner';
import type { GlobalSettings, Comorbidity } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';
const inpSm =
  'rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-lg bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs text-gray-500">{label}</label>
      {children}
    </div>
  );
}

export default function SettingsTab() {
  const settings = useDataStore((s) => s.settings);
  const [draft, setDraft] = useState<GlobalSettings>(() => structuredClone(settings));
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');

  const set = <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveDoc('settings', 'global', draft as unknown as Record<string, unknown>);
      showFlash('저장됨');
    } catch {
      showFlash('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('기본값으로 초기화하시겠습니까?')) return;
    setSaving(true);
    try {
      await uploadSettings();
      showFlash('초기화됨');
    } catch {
      showFlash('초기화 실패');
    } finally {
      setSaving(false);
    }
  };

  const updateComorb = (idx: number, key: keyof Comorbidity, value: string) => {
    const next = [...draft.comorbidities];
    next[idx] = { ...next[idx], [key]: value };
    set('comorbidities', next);
  };

  return (
    <div>
      {/* 로그인 화면 */}
      <Section title="로그인 화면">
        <Field label="메인 타이틀">
          <input className={inp} value={draft.loginMainTitle} onChange={(e) => set('loginMainTitle', e.target.value)} />
        </Field>
        <Field label="서브 타이틀">
          <input className={inp} value={draft.loginSubTitle} onChange={(e) => set('loginSubTitle', e.target.value)} />
        </Field>
        <div className="flex gap-3">
          <Field label="배경 시작색">
            <div className="flex gap-1">
              <input type="color" value={draft.loginBgStart} onChange={(e) => set('loginBgStart', e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
              <input className={`${inpSm} flex-1`} value={draft.loginBgStart} onChange={(e) => set('loginBgStart', e.target.value)} />
            </div>
          </Field>
          <Field label="배경 끝색">
            <div className="flex gap-1">
              <input type="color" value={draft.loginBgEnd} onChange={(e) => set('loginBgEnd', e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
              <input className={`${inpSm} flex-1`} value={draft.loginBgEnd} onChange={(e) => set('loginBgEnd', e.target.value)} />
            </div>
          </Field>
        </div>
        <Field label="버튼 색상">
          <div className="flex gap-1">
            <input type="color" value={draft.loginBtnColor} onChange={(e) => set('loginBtnColor', e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
            <input className={`${inpSm} flex-1`} value={draft.loginBtnColor} onChange={(e) => set('loginBtnColor', e.target.value)} />
          </div>
        </Field>
        <Field label="로고 URL">
          <input className={inp} value={draft.loginLogoUrl} onChange={(e) => set('loginLogoUrl', e.target.value)} placeholder="https://..." />
        </Field>
        <Field label="타이틀 아이콘 URL">
          <input className={inp} value={draft.loginTitleIconUrl} onChange={(e) => set('loginTitleIconUrl', e.target.value)} placeholder="https://..." />
        </Field>
        <Field label="배경 이미지 URL">
          <input className={inp} value={draft.backgroundImgUrl} onChange={(e) => set('backgroundImgUrl', e.target.value)} placeholder="https://..." />
        </Field>
        <Field label="의사 이미지 URL">
          <input className={inp} value={draft.encounterDoctorImg} onChange={(e) => set('encounterDoctorImg', e.target.value)} placeholder="https://..." />
        </Field>
      </Section>

      {/* 처방 기준값 */}
      <Section title="처방 기준값">
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="병포장 보너스 (HbA1c 강하)">
            <input type="number" step="0.1" className={inp} value={draft.packagingBonusEffect} onChange={(e) => set('packagingBonusEffect', +e.target.value)} />
          </Field>
          <Field label="초기 메트포르민 기준 HbA1c">
            <input type="number" step="0.1" className={inp} value={draft.initialMetforminThreshold} onChange={(e) => set('initialMetforminThreshold', +e.target.value)} />
          </Field>
          <Field label="2제 병용 기준 HbA1c">
            <input type="number" step="0.1" className={inp} value={draft.dualTherapyThreshold} onChange={(e) => set('dualTherapyThreshold', +e.target.value)} />
          </Field>
          <Field label="SGLT-2i eGFR 하한">
            <input type="number" className={inp} value={draft.sglt2EgfrLimit} onChange={(e) => set('sglt2EgfrLimit', +e.target.value)} />
          </Field>
        </div>
        <p className="mb-2 text-xs font-medium text-gray-500">심부전(HF) 특례</p>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="LVEF 최대값">
            <input type="number" className={inp} value={draft.hfLvefMax} onChange={(e) => set('hfLvefMax', +e.target.value)} />
          </Field>
          <Field label="NYHA 최솟값">
            <input type="number" className={inp} value={draft.hfNyhaMin} onChange={(e) => set('hfNyhaMin', +e.target.value)} />
          </Field>
          <Field label="BNP 최솟값">
            <input type="number" className={inp} value={draft.hfBnpMin} onChange={(e) => set('hfBnpMin', +e.target.value)} />
          </Field>
          <Field label="NT-proBNP 최솟값">
            <input type="number" className={inp} value={draft.hfNtprobnpMin} onChange={(e) => set('hfNtprobnpMin', +e.target.value)} />
          </Field>
        </div>
        <p className="mb-2 text-xs font-medium text-gray-500">만성신장질환(CKD) 특례</p>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="eGFR 최솟값">
            <input type="number" className={inp} value={draft.ckdEgfrMin} onChange={(e) => set('ckdEgfrMin', +e.target.value)} />
          </Field>
          <Field label="eGFR 최대값">
            <input type="number" className={inp} value={draft.ckdEgfrMax} onChange={(e) => set('ckdEgfrMax', +e.target.value)} />
          </Field>
          <Field label="UACR 최솟값">
            <input type="number" className={inp} value={draft.ckdUacrMin} onChange={(e) => set('ckdUacrMin', +e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* 메시지 */}
      <Section title="환자 메시지">
        {(
          [
            { key: 'msgSuccess', label: '정상 처방' },
            { key: 'msgSideEffect', label: '부작용 발생' },
            { key: 'msgPackaging', label: '병포장' },
            { key: 'msgLifestyle', label: '생활습관만' },
          ] as const
        ).map(({ key, label }) => (
          <Field key={key} label={label}>
            <textarea
              rows={2}
              className={`${inp} resize-none`}
              value={draft[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </Field>
        ))}
      </Section>

      {/* 공병증 */}
      <Section title="공병증 메시지">
        {draft.comorbidities.map((c, i) => (
          <div key={c.name} className="mb-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
            <p className="mb-1.5 text-xs font-semibold text-gray-700">{c.name}</p>
            <Field label="호전 메시지">
              <input className={inp} value={c.goodMsg} onChange={(e) => updateComorb(i, 'goodMsg', e.target.value)} />
            </Field>
            <Field label="악화 메시지">
              <input className={inp} value={c.badMsg} onChange={(e) => updateComorb(i, 'badMsg', e.target.value)} />
            </Field>
            <Field label="색상">
              <div className="flex gap-1">
                <input type="color" value={c.color ?? '#6366f1'} onChange={(e) => updateComorb(i, 'color', e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
                <input className={`${inpSm} flex-1`} value={c.color ?? ''} onChange={(e) => updateComorb(i, 'color', e.target.value)} placeholder="#6366f1" />
              </div>
            </Field>
          </div>
        ))}
      </Section>

      {/* 시스템 */}
      <Section title="시스템">
        <Field label="Admin 비밀번호">
          <input type="text" className={inp} value={draft.adminPassword} onChange={(e) => set('adminPassword', e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.allowSessionCarryover}
            onChange={(e) => set('allowSessionCarryover', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
          />
          세션 이어받기 허용 (같은 병원·의사 재로그인 시 이전 처방 누적)
        </label>
      </Section>

      {/* 액션 바 */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={saving}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          기본 초기화
        </button>
      </div>
      {flash && <p className="mb-4 text-center text-sm font-medium text-indigo-600">{flash}</p>}
    </div>
  );
}
