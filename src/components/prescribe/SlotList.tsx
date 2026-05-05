import type { Medication } from '../../types';
import SlotItem from './SlotItem';

interface SlotListProps {
  slots: (string | null)[];
  medications: Medication[];
  currentEgfr: number;
  onChangeSlot: (slotIndex: number) => void;
}

export default function SlotList({ slots, medications, currentEgfr, onChangeSlot }: SlotListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {slots.map((id, idx) => {
        const med = id ? medications.find((m) => m.id === id) ?? null : null;
        return (
          <li key={idx}>
            <SlotItem
              slotIndex={idx}
              medication={med}
              currentEgfr={currentEgfr}
              onChange={onChangeSlot}
            />
          </li>
        );
      })}
    </ul>
  );
}
