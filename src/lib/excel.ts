// 의존성 없이 여러 시트(탭)를 가진 엑셀 파일을 만든다.
// SpreadsheetML 2003 (.xls) XML 포맷 — Excel/구글시트에서 탭별로 열린다.

export type CellValue = string | number | null | undefined;

export interface Sheet {
  name: string;
  headers: string[];
  rows: CellValue[][];
}

function escapeXml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 엑셀 시트 이름 제약: 31자 이하, : \ / ? * [ ] 금지 */
function safeSheetName(name: string, fallback: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31);
  return cleaned || fallback;
}

function cellXml(value: CellValue): string {
  if (value === null || value === undefined || value === '') {
    return '<Cell><Data ss:Type="String"></Data></Cell>';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`;
}

function rowXml(cells: CellValue[]): string {
  return `<Row>${cells.map(cellXml).join('')}</Row>`;
}

function sheetXml(sheet: Sheet, index: number): string {
  const name = safeSheetName(sheet.name, `Sheet${index + 1}`);
  const header = `<Row ss:StyleID="hdr">${sheet.headers
    .map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join('')}</Row>`;
  const body = sheet.rows.map(rowXml).join('');
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${header}${body}</Table></Worksheet>`;
}

export function buildWorkbookXml(sheets: Sheet[]): string {
  const worksheets = sheets.map(sheetXml).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/></Style>
 </Styles>
 ${worksheets}
</Workbook>`;
}

export function downloadWorkbook(filename: string, sheets: Sheet[]): void {
  const xml = buildWorkbookXml(sheets);
  // BOM + Excel용 MIME
  const blob = new Blob(['﻿' + xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
