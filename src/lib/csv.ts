import type { RxSession } from '../types';

export function sessionsToCSV(sessions: RxSession[]): string {
  const headers = [
    '병원',
    '의사',
    '환자',
    '날짜',
    '약제1',
    '약제2',
    '약제3',
    '약제4',
    '약제5',
    '이전HbA1c',
    '새HbA1c',
    '삭감사유',
    '부작용',
  ];

  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

  const rows = sessions.flatMap((s) =>
    s.prescriptions.map((p) => {
      const drugs = Array.from({ length: 5 }, (_, i) => {
        const found = p.prescribedDrugs.find((d) => d.slot === i);
        return found ? found.name : '';
      });
      return [
        s.hospitalName,
        s.doctorName,
        p.patientName,
        p.timestamp.slice(0, 10),
        ...drugs,
        p.oldHba1c.toFixed(1),
        p.newHba1c.toFixed(1),
        p.deductionReasons.join('; '),
        p.sideEffects.join('; '),
      ].map(escape);
    }),
  );

  return [headers.map(escape).join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
