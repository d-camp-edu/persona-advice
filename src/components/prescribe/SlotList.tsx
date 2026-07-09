import type { Medication } from '../../types';
import SlotItem from './SlotItem';

interface SlotListProps {
  slots: (string | null)[];
  slotBids: boolean[];
  medications: Medication[];
  currentEgfr: number;
  onChangeSlot: (slotIndex: number) => void;
  onToggleBid: (slotIndex: number) => void;
}

export default function SlotList({
  slots,
  slotBids,
  medications,
  currentEgfr,
  onChangeSlot,
  onToggleBid,
}: SlotListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {slots.map((id, idx) => {
        const med = id ? medications.find((m) => m.id === id) ?? null : null;
        return (
          <li key={idx}>
            <SlotItem
              slotIndex={idx}
              medication={med}
              bid={!!slotBids[idx]}
              currentEgfr={currentEgfr}
              onChange={onChangeSlot}
              onToggleBid={onToggleBid}
            />
          </li>
        );
      })}
    </ul>
  );
}
