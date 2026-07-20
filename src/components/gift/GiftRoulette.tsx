import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Gift } from '../../types';
import type { InstitutionType } from '../../store/useSessionStore';
import { pickWinnerWithRate } from '../../lib/giftWin';

const ITEM_H = 88;
const VISIBLE = 3;
const PRE_COUNT = 22; // random items before winner in strip

interface RouletteItem {
  gift: Gift | null; // null = 꽝
  key: string;
}

function pickWinner(
  gifts: Gift[],
  institutionType: InstitutionType,
  winRateOverride: number | null,
): Gift | null {
  // 공병별 총 당첨 확률이 지정된 경우: 해당 확률로 당첨 여부 결정 후, 선물은 기존 확률 비율로 추첨.
  if (winRateOverride !== null) {
    return pickWinnerWithRate(gifts, institutionType, winRateOverride, Math.random(), Math.random());
  }

  const probs = gifts.map((g) =>
    institutionType === '병원' ? g.probHospital : g.probClinic,
  );
  const totalGift = probs.reduce((s, p) => s + p, 0);
  const kwangProb = Math.max(0, 100 - totalGift);

  const rand = Math.random() * 100;
  let cum = 0;
  for (let i = 0; i < gifts.length; i++) {
    cum += probs[i];
    if (rand < cum) return gifts[i];
  }
  if (rand < cum + kwangProb) return null; // 꽝
  return null;
}

function buildStrip(
  gifts: Gift[],
  institutionType: InstitutionType,
  winRateOverride: number | null,
): { items: RouletteItem[]; winnerIdx: number } {
  const winner = pickWinner(gifts, institutionType, winRateOverride);

  // 스트립에 흘러가는 "장식용" 아이템: 실제 당첨 확률과 무관하게 보이는 비율은 선물:꽝 = 반반.
  // (당첨 결과는 winner = pickWinner 로 이미 확률대로 결정됨)
  const rand = (): Gift | null => {
    if (gifts.length === 0) return null;
    return Math.random() < 0.5 ? null : gifts[Math.floor(Math.random() * gifts.length)];
  };

  const items: RouletteItem[] = [];
  for (let i = 0; i < PRE_COUNT; i++) {
    items.push({ gift: rand(), key: `pre-${i}` });
  }
  const winnerIdx = items.length;
  items.push({ gift: winner, key: 'winner' });
  // 2 items after winner (for visual buffer)
  for (let i = 0; i < 2; i++) {
    items.push({ gift: rand(), key: `post-${i}` });
  }

  return { items, winnerIdx };
}

function ItemCell({ item, highlight }: { item: RouletteItem; highlight: boolean }) {
  const isKwang = item.gift === null;
  return (
    <div
      style={{ height: ITEM_H }}
      className={`flex flex-shrink-0 items-center justify-center gap-3 rounded-xl transition-all ${
        highlight
          ? 'bg-amber-50 ring-2 ring-amber-300'
          : 'bg-white/10'
      }`}
    >
      {isKwang ? (
        <div className="flex flex-col items-center">
          <span className="text-3xl">😢</span>
          <span className="mt-0.5 text-xs font-bold text-white/80">꽝</span>
        </div>
      ) : item.gift?.imageUrl ? (
        <img
          src={item.gift.imageUrl}
          alt={item.gift.name}
          className="h-14 w-14 rounded-lg object-contain"
        />
      ) : (
        <div className="flex flex-col items-center">
          <span className="text-3xl">🎁</span>
          <span className="mt-0.5 max-w-[120px] truncate text-xs font-bold text-white/90">
            {item.gift?.name}
          </span>
        </div>
      )}
      {!isKwang && item.gift?.imageUrl && (
        <span className="max-w-[100px] truncate text-sm font-semibold text-white drop-shadow">
          {item.gift.name}
        </span>
      )}
    </div>
  );
}

interface Props {
  gifts: Gift[];
  institutionType: InstitutionType;
  /** 공병별로 지정된 총 당첨 확률(%). null이면 선물별 확률 합(기존 동작). */
  winRateOverride?: number | null;
  onClose: () => void;
  /** 룰렛 1회가 끝났을 때 결과(당첨 선물 또는 null=꽝)를 알려준다. 로깅용. */
  onResult?: (gift: Gift | null) => void;
}

export default function GiftRoulette({
  gifts,
  institutionType,
  winRateOverride = null,
  onClose,
  onResult,
}: Props) {
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'done'>('idle');
  const [items, setItems] = useState<RouletteItem[]>([]);
  const [winnerIdx, setWinnerIdx] = useState(0);
  const [winner, setWinner] = useState<Gift | null | undefined>(undefined);
  const rafRef = useRef<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const spin = () => {
    if (phase === 'spinning') return;
    const { items: strip, winnerIdx: wIdx } = buildStrip(gifts, institutionType, winRateOverride);
    setItems(strip);
    setWinnerIdx(wIdx);
    setWinner(undefined);
    setPhase('spinning');

    // center winner: item[wIdx] in center means item[wIdx-1] at top of viewport
    const finalY = -(wIdx - 1) * ITEM_H;

    // Two-phase animation via rAF + inline style transitions
    // Phase 1: fast (1.6s linear to midpoint)
    // Phase 2: slow ease-out (2.4s to final)
    const midIdx = Math.floor(PRE_COUNT / 2);
    const midY = -(midIdx - 1) * ITEM_H;

    requestAnimationFrame(() => {
      if (!stripRef.current) return;
      stripRef.current.style.transition = `transform 1.6s linear`;
      stripRef.current.style.transform = `translateY(${midY}px)`;

      const t1 = setTimeout(() => {
        if (!stripRef.current) return;
        stripRef.current.style.transition = `transform 2.4s cubic-bezier(0.12, 0.9, 0.3, 1)`;
        stripRef.current.style.transform = `translateY(${finalY}px)`;

        const t2 = setTimeout(() => {
          setPhase('done');
          const result = strip[wIdx].gift ?? null;
          setWinner(result);
          onResult?.(result);
        }, 2500);
        rafRef.current = t2 as unknown as number;
      }, 1700);
      rafRef.current = t1 as unknown as number;
    });
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) clearTimeout(rafRef.current);
    };
  }, []);

  const viewportH = VISIBLE * ITEM_H;
  const isKwang = winner === null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800">
      {/* 닫기 */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex items-center justify-center rounded-full bg-white/20 p-2 text-white backdrop-blur-sm hover:bg-white/30"
        aria-label="닫기"
      >
        <X size={20} />
      </button>

      <h2 className="mb-6 text-xl font-bold text-white drop-shadow">
        {phase === 'idle' ? '선물 룰렛' : phase === 'spinning' ? '두근두근…' : isKwang ? '아쉽네요 😢' : '축하합니다! 🎉'}
      </h2>

      {/* Slot viewport */}
      <div
        style={{ height: viewportH, width: 260 }}
        className="relative overflow-hidden rounded-2xl border-2 border-white/20 bg-black/30 shadow-2xl"
      >
        {/* Center highlight bar */}
        <div
          className="pointer-events-none absolute inset-x-0 z-10 rounded-xl border-2 border-amber-300 bg-amber-100/10"
          style={{ top: ITEM_H, height: ITEM_H }}
        />
        {/* Top & bottom fades */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-black/50 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Strip */}
        <div ref={stripRef} style={{ willChange: 'transform' }}>
          {phase === 'idle' ? (
            // Idle: show placeholder items
            Array.from({ length: VISIBLE }, (_, i) => (
              <div
                key={i}
                style={{ height: ITEM_H }}
                className="flex items-center justify-center"
              >
                <span className="text-4xl opacity-30">🎁</span>
              </div>
            ))
          ) : (
            items.map((item, i) => (
              <ItemCell
                key={item.key}
                item={item}
                highlight={phase === 'done' && i === winnerIdx}
              />
            ))
          )}
        </div>
      </div>

      {/* Result message */}
      {phase === 'done' && winner !== undefined && (
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          {!isKwang && winner?.imageUrl && (
            <img
              src={winner.imageUrl}
              alt={winner.name}
              className="h-24 w-24 rounded-2xl object-contain shadow-xl ring-4 ring-amber-300"
            />
          )}
          <p className={`text-2xl font-bold ${isKwang ? 'text-gray-300' : 'text-amber-300'}`}>
            {isKwang ? '다음 기회에!' : winner?.name}
          </p>
        </div>
      )}

      {/* 룰렛은 환자당 1회만 — done 이후엔 다시 돌리지 않고 확인(닫기)만 노출 */}
      {phase === 'done' ? (
        <button
          type="button"
          onClick={onClose}
          className="mt-8 rounded-full bg-white px-10 py-4 text-base font-bold text-indigo-700 shadow-xl transition active:scale-95 hover:bg-white/90"
        >
          확인
        </button>
      ) : (
        <button
          type="button"
          onClick={spin}
          disabled={phase === 'spinning'}
          className="mt-8 rounded-full bg-amber-400 px-10 py-4 text-base font-bold text-amber-900 shadow-xl transition active:scale-95 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === 'idle' ? '룰렛 돌리기' : '돌리는 중…'}
        </button>
      )}

      <p className="mt-3 text-xs text-white/40">
        {phase === 'done'
          ? '환자당 1회만 참여할 수 있습니다'
          : winRateOverride !== null
            ? `${institutionType} · 공병 기준 당첨 확률 ${winRateOverride}% 적용 중`
            : `${institutionType} 기준 확률 적용 중`}
      </p>
    </div>,
    document.body,
  );
}
