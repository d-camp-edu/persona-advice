// Admin '진행률' 탭의 타겟처 목록 관리 섹션.
// 엑셀로 올린 타겟처를 캠페인별로 조회하고, 개별 추가 / 인라인 수정 / 삭제한다.
//
// 문서 id 는 엑셀 업로드와 동일한 makeTargetId() 규칙을 쓴다.
// → 수동으로 추가한 거래처가 나중에 같은 엑셀에 들어와도 중복 문서가 생기지 않는다.

import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { makeTargetId } from '../../lib/targetExcelImport';
import {
  saveTarget,
  deleteTarget,
  deleteTargets,
  deleteCompletionsByTargets,
} from '../../lib/targetsRepo';
import type { Target, TargetCampaign, TargetCompletion, TargetInstitution } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';
const inpXs =
  'w-full min-w-0 rounded border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-indigo-500';

type Draft = Omit<Target, 'id' | 'campaignId'>;

function emptyDraft(): Draft {
  return {
    code: '',
    name: '',
    institutionType: '의원',
    drName: '',
    division: '',
    team: '',
    empNo: '',
    empName: '',
  };
}

interface Props {
  campaigns: TargetCampaign[];
  targets: Target[];
  completions: TargetCompletion[];
  /** 저장·삭제 후 대시보드/목록을 다시 불러오기 위한 콜백 */
  onChanged: () => void | Promise<void>;
  showFlash: (msg: string) => void;
}

export default function TargetListSection({
  campaigns,
  targets,
  completions,
  onChanged,
  showFlash,
}: Props) {
  const [campaignId, setCampaignId] = useState('');
  const [q, setQ] = useState('');
  const [division, setDivision] = useState('all');
  const [team, setTeam] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);

  // 캠페인 기본 선택
  useEffect(() => {
    if (!campaignId && campaigns.length > 0) setCampaignId(campaigns[0].id);
  }, [campaigns, campaignId]);

  // 캠페인이 바뀌면 선택/편집 상태 초기화
  useEffect(() => {
    setSelected(new Set());
    setEditingId(null);
    setDivision('all');
    setTeam('all');
  }, [campaignId]);

  const campaignTargets = useMemo(
    () => targets.filter((t) => t.campaignId === campaignId),
    [targets, campaignId],
  );

  const doneIds = useMemo(
    () =>
      new Set(
        completions.filter((c) => c.campaignId === campaignId).map((c) => c.targetId),
      ),
    [completions, campaignId],
  );

  const divisions = useMemo(
    () => [...new Set(campaignTargets.map((t) => t.division).filter(Boolean))].sort(),
    [campaignTargets],
  );
  const teams = useMemo(
    () =>
      [
        ...new Set(
          campaignTargets
            .filter((t) => division === 'all' || t.division === division)
            .map((t) => t.team)
            .filter(Boolean),
        ),
      ].sort(),
    [campaignTargets, division],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return campaignTargets
      .filter((t) => division === 'all' || t.division === division)
      .filter((t) => team === 'all' || t.team === team)
      .filter((t) => {
        if (!needle) return true;
        return [t.code, t.name, t.drName, t.empNo, t.empName, t.division, t.team]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort(
        (a, b) =>
          a.division.localeCompare(b.division, 'ko') ||
          a.team.localeCompare(b.team, 'ko') ||
          a.name.localeCompare(b.name, 'ko') ||
          a.drName.localeCompare(b.drName, 'ko'),
      );
  }, [campaignTargets, division, team, q]);

  // 필터가 바뀌면 화면에 없는 항목의 선택은 풀어둔다(안 보이는 걸 지우는 사고 방지).
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(filtered.map((t) => t.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  const validate = (d: Draft): string | null => {
    if (!campaignId) return '캠페인을 먼저 선택하세요.';
    if (!d.code.trim() && !d.name.trim()) return '거래처코드 또는 거래처명 중 하나는 필요합니다.';
    if (!d.empNo.trim()) return '담당자 사번은 필수입니다. (사번으로 로그인 검색을 합니다)';
    return null;
  };

  const toTarget = (d: Draft): Target => {
    const code = d.code.trim();
    const name = d.name.trim();
    const drName = d.drName.trim();
    const empNo = d.empNo.trim();
    return {
      id: makeTargetId(campaignId, code, name, drName, empNo),
      campaignId,
      code,
      name,
      institutionType: d.institutionType,
      drName,
      division: d.division.trim(),
      team: d.team.trim(),
      empNo,
      empName: d.empName.trim(),
    };
  };

  const handleAdd = async () => {
    const err = validate(addDraft);
    if (err) {
      showFlash(err);
      return;
    }
    const t = toTarget(addDraft);
    if (campaignTargets.some((x) => x.id === t.id)) {
      if (!confirm('같은 거래처·Dr.·사번의 타겟처가 이미 있습니다. 덮어쓸까요?')) return;
    }
    setBusy(true);
    try {
      await saveTarget(t);
      showFlash(`타겟처 '${t.name || t.code}' 추가됨`);
      setAddDraft(emptyDraft());
      setShowAdd(false);
      await onChanged();
    } catch (e) {
      showFlash(`추가 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (t: Target) => {
    setEditingId(t.id);
    setEditDraft({
      code: t.code,
      name: t.name,
      institutionType: t.institutionType,
      drName: t.drName,
      division: t.division,
      team: t.team,
      empNo: t.empNo,
      empName: t.empName,
    });
  };

  const handleSaveEdit = async (original: Target) => {
    const err = validate(editDraft);
    if (err) {
      showFlash(err);
      return;
    }
    const updated = toTarget(editDraft);
    setBusy(true);
    try {
      await saveTarget(updated);
      // 거래처/Dr./사번을 바꾸면 id 규칙상 새 문서가 되므로 옛 문서를 지운다.
      if (updated.id !== original.id) {
        await deleteTarget(original.id);
        if (doneIds.has(original.id)) {
          showFlash('수정됨 — 식별정보가 바뀌어 이 타겟처의 진행 완료 기록은 초기화됩니다.');
          await deleteCompletionsByTargets(campaignId, [original.id]);
        }
      }
      if (updated.id === original.id) showFlash('수정됨');
      setEditingId(null);
      await onChanged();
    } catch (e) {
      showFlash(`수정 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const removeMany = async (ids: string[], label: string) => {
    const doneCount = ids.filter((id) => doneIds.has(id)).length;
    let alsoDeleteCompletions = false;
    if (doneCount > 0) {
      alsoDeleteCompletions = confirm(
        `${label}\n\n이 중 ${doneCount}건은 이미 '진행 완료'된 타겟처입니다.\n\n` +
          '[확인] 완료 기록도 함께 삭제\n[취소] 완료 기록은 남기고 타겟처만 삭제',
      );
    } else if (!confirm(label)) {
      return;
    }
    setBusy(true);
    try {
      await deleteTargets(ids);
      if (alsoDeleteCompletions) await deleteCompletionsByTargets(campaignId, ids);
      showFlash(`${ids.length}건 삭제됨${alsoDeleteCompletions ? ' (완료 기록 포함)' : ''}`);
      setSelected(new Set());
      setEditingId(null);
      await onChanged();
    } catch (e) {
      showFlash(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisibleSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        <Building2 size={15} /> 타겟처 목록 관리
      </h3>
      <p className="mb-3 text-xs leading-snug text-gray-500">
        엑셀로 올린 타겟처를 직접 추가·수정·삭제합니다. 거래처·Dr.명·사번이 같으면 엑셀 업로드와 같은
        문서로 취급하므로 중복이 생기지 않습니다.
        <br />
        <span className="text-amber-600">
          단, 엑셀을 '기존 타겟처 교체' 모드로 다시 올리면 여기서 추가한 건도 함께 지워집니다.
        </span>
      </p>

      {/* 캠페인 선택 + 검색 + 필터 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className={`${inp} w-auto`}
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        >
          <option value="">캠페인 선택…</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.month})
            </option>
          ))}
        </select>
        <div className="relative min-w-[10rem] flex-1">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className={`${inp} pl-7`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="거래처명·코드·사번·담당자 검색"
          />
        </div>
        <select
          className="rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-500"
          value={division}
          onChange={(e) => {
            setDivision(e.target.value);
            setTeam('all');
          }}
        >
          <option value="all">전체 사업부</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-500"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
        >
          <option value="all">전체 팀</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          disabled={!campaignId}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus size={14} /> 타겟처 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {showAdd && campaignId && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 sm:grid-cols-4">
          <Field label="기관유형">
            <select
              className={inpXs}
              value={addDraft.institutionType}
              onChange={(e) =>
                setAddDraft((d) => ({
                  ...d,
                  institutionType: e.target.value as TargetInstitution,
                }))
              }
            >
              <option value="의원">의원</option>
              <option value="병원">병원</option>
            </select>
          </Field>
          <Field label="거래처코드">
            <input
              className={inpXs}
              value={addDraft.code}
              onChange={(e) => setAddDraft((d) => ({ ...d, code: e.target.value }))}
            />
          </Field>
          <Field label="거래처명">
            <input
              className={inpXs}
              value={addDraft.name}
              onChange={(e) => setAddDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </Field>
          <Field label="Dr.명 (병원)">
            <input
              className={inpXs}
              value={addDraft.drName}
              onChange={(e) => setAddDraft((d) => ({ ...d, drName: e.target.value }))}
            />
          </Field>
          <Field label="사업부명">
            <input
              className={inpXs}
              value={addDraft.division}
              onChange={(e) => setAddDraft((d) => ({ ...d, division: e.target.value }))}
            />
          </Field>
          <Field label="팀명">
            <input
              className={inpXs}
              value={addDraft.team}
              onChange={(e) => setAddDraft((d) => ({ ...d, team: e.target.value }))}
            />
          </Field>
          <Field label="담당자사번 *">
            <input
              className={inpXs}
              value={addDraft.empNo}
              onChange={(e) => setAddDraft((d) => ({ ...d, empNo: e.target.value }))}
            />
          </Field>
          <Field label="담당자명">
            <input
              className={inpXs}
              value={addDraft.empName}
              onChange={(e) => setAddDraft((d) => ({ ...d, empName: e.target.value }))}
            />
          </Field>
          <div className="col-span-2 flex gap-2 sm:col-span-4">
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Check size={13} /> 추가
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setAddDraft(emptyDraft());
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 선택 삭제 바 */}
      {selected.size > 0 && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
          <span className="text-xs font-medium text-red-700">{selected.size}건 선택됨</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              선택 해제
            </button>
            <button
              type="button"
              onClick={() =>
                void removeMany([...selected], `선택한 ${selected.size}건을 삭제하시겠습니까?`)
              }
              disabled={busy}
              className="flex items-center gap-1 rounded bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
            >
              <Trash2 size={12} /> 선택 삭제
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {!campaignId ? (
        <p className="rounded-lg bg-gray-50 px-3 py-6 text-center text-xs text-gray-400">
          캠페인을 선택하세요.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg bg-gray-50 px-3 py-6 text-center text-xs text-gray-400">
          {campaignTargets.length === 0
            ? '이 캠페인에 등록된 타겟처가 없습니다. 엑셀 업로드 또는 위 버튼으로 추가하세요.'
            : '검색·필터 조건에 맞는 타겟처가 없습니다.'}
        </p>
      ) : (
        <>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={allVisibleSelected}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(filtered.map((t) => t.id)) : new Set())
                }
              />
              전체 선택
            </label>
            <span className="text-xs text-gray-400">
              {filtered.length}건 표시 / 캠페인 전체 {campaignTargets.length}건
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="w-8 px-2 py-1.5" />
                  <th className="px-2 py-1.5 font-medium">거래처</th>
                  <th className="px-2 py-1.5 font-medium">Dr.</th>
                  <th className="px-2 py-1.5 font-medium">사업부·팀</th>
                  <th className="px-2 py-1.5 font-medium">담당자</th>
                  <th className="px-2 py-1.5 font-medium">진행</th>
                  <th className="w-20 px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) =>
                  editingId === t.id ? (
                    <tr key={t.id} className="bg-indigo-50/40">
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5">
                        <input
                          className={`${inpXs} mb-1`}
                          value={editDraft.code}
                          placeholder="거래처코드"
                          onChange={(e) => setEditDraft((d) => ({ ...d, code: e.target.value }))}
                        />
                        <input
                          className={inpXs}
                          value={editDraft.name}
                          placeholder="거래처명"
                          onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={`${inpXs} mb-1`}
                          value={editDraft.drName}
                          placeholder="Dr.명"
                          onChange={(e) => setEditDraft((d) => ({ ...d, drName: e.target.value }))}
                        />
                        <select
                          className={inpXs}
                          value={editDraft.institutionType}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              institutionType: e.target.value as TargetInstitution,
                            }))
                          }
                        >
                          <option value="의원">의원</option>
                          <option value="병원">병원</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={`${inpXs} mb-1`}
                          value={editDraft.division}
                          placeholder="사업부"
                          onChange={(e) => setEditDraft((d) => ({ ...d, division: e.target.value }))}
                        />
                        <input
                          className={inpXs}
                          value={editDraft.team}
                          placeholder="팀"
                          onChange={(e) => setEditDraft((d) => ({ ...d, team: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={`${inpXs} mb-1`}
                          value={editDraft.empNo}
                          placeholder="사번"
                          onChange={(e) => setEditDraft((d) => ({ ...d, empNo: e.target.value }))}
                        />
                        <input
                          className={inpXs}
                          value={editDraft.empName}
                          placeholder="담당자명"
                          onChange={(e) => setEditDraft((d) => ({ ...d, empName: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit(t)}
                            disabled={busy}
                            aria-label="저장"
                            className="rounded bg-indigo-600 p-1.5 text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            aria-label="취소"
                            className="rounded border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.id} className={selected.has(t.id) ? 'bg-red-50/40' : undefined}>
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5"
                          checked={selected.has(t.id)}
                          onChange={() => toggleSel(t.id)}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-gray-800">
                        {t.name || '—'}
                        {t.code && <span className="ml-1 text-gray-400">{t.code}</span>}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600">
                        {t.drName || '—'}
                        <span className="ml-1 text-[10px] text-gray-400">{t.institutionType}</span>
                      </td>
                      <td className="px-2 py-1.5 text-gray-500">
                        {[t.division, t.team].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600">
                        {t.empName || '—'}
                        {t.empNo && <span className="ml-1 text-gray-400">{t.empNo}</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {doneIds.has(t.id) ? (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                            완료
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300">미완료</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(t)}
                            aria-label="수정"
                            className="rounded border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void removeMany(
                                [t.id],
                                `'${t.name || t.code}${t.drName ? ` / ${t.drName}` : ''}'을 삭제하시겠습니까?`,
                              )
                            }
                            disabled={busy}
                            aria-label="삭제"
                            className="rounded border border-red-200 p-1.5 text-red-400 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-0.5 block text-[11px] text-gray-500">{label}</label>
      {children}
    </div>
  );
}
