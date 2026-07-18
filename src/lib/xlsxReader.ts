// 의존성 없이 브라우저에서 .xlsx(첫 시트)를 읽어 행 배열(string[][])로 반환하는 범용 리더.
// medExcelImport.ts 의 zip/시트 파싱 로직과 동일한 방식이지만, 약제 전용 매핑이 없는
// 순수 리더다. (medExcelImport.ts 는 드리프트 테스트가 있어 건드리지 않고 여기에 별도 구현)
//
// zip 인플레이트: 브라우저 내장 DecompressionStream('deflate-raw')
// 시트 XML: 정규식. inlineStr(<is><t>)·sharedStrings(<v t="s">)·숫자 모두 지원.

function u16(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8);
}
function u32(b: Uint8Array, o: number) {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

async function readZipEntries(
  buf: Uint8Array,
  want: (name: string) => boolean,
): Promise<Record<string, Uint8Array>> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (u32(buf, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('올바른 xlsx(zip) 파일이 아닙니다.');
  const count = u16(buf, eocd + 10);
  let cd = u32(buf, eocd + 16);
  const dec = new TextDecoder('utf-8');
  const out: Record<string, Uint8Array> = {};
  for (let n = 0; n < count; n++) {
    if (u32(buf, cd) !== 0x02014b50) throw new Error('zip 중앙 디렉터리 헤더 손상');
    const method = u16(buf, cd + 10);
    const compSize = u32(buf, cd + 20);
    const nameLen = u16(buf, cd + 28);
    const extraLen = u16(buf, cd + 30);
    const commentLen = u16(buf, cd + 32);
    const localOff = u32(buf, cd + 42);
    const name = dec.decode(buf.subarray(cd + 46, cd + 46 + nameLen));
    if (want(name)) {
      const lhNameLen = u16(buf, localOff + 26);
      const lhExtraLen = u16(buf, localOff + 28);
      const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
      const comp = buf.subarray(dataStart, dataStart + compSize);
      out[name] = method === 0 ? comp.slice() : await inflateRaw(comp);
    }
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function colToIdx(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const body = m[1] ?? '';
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;
    let s = '';
    while ((t = tRe.exec(body))) s += decodeXml(t[1]);
    out.push(s);
  }
  return out;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(xml))) {
    const rIdx = +m[1];
    const cellsXml = m[2];
    const cells: Record<number, string> = {};
    const cRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
    let c: RegExpExecArray | null;
    while ((c = cRe.exec(cellsXml))) {
      const attrs = c[1] ?? c[3] ?? '';
      const refM = attrs.match(/r="([A-Z]+)\d+"/);
      if (!refM) continue;
      const col = colToIdx(refM[1]);
      if (c[3] !== undefined) {
        cells[col] = '';
        continue;
      }
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? '';
      const inner = c[2];
      const isM = inner.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
      const vM = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (type === 'inlineStr' || isM) {
        cells[col] = isM ? decodeXml(isM[1]) : '';
      } else if (vM) {
        const raw = decodeXml(vM[1]);
        cells[col] = type === 's' ? shared[+raw] ?? '' : raw;
      } else {
        cells[col] = '';
      }
    }
    let maxCol = -1;
    for (const k of Object.keys(cells)) if (+k > maxCol) maxCol = +k;
    const arr: string[] = [];
    for (let i = 0; i <= maxCol; i++) arr.push(cells[i] ?? '');
    rows[rIdx] = arr;
  }
  return rows;
}

/** xlsx(File/Blob/ArrayBuffer/Uint8Array) → 첫 시트의 행 배열. 빈 행은 undefined일 수 있다. */
export async function readXlsxRows(
  input: File | Blob | ArrayBuffer | Uint8Array,
): Promise<string[][]> {
  let bytes: Uint8Array;
  if (input instanceof Uint8Array) bytes = input;
  else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
  else bytes = new Uint8Array(await input.arrayBuffer());

  const entries = await readZipEntries(
    bytes,
    (name) => name === 'xl/worksheets/sheet1.xml' || name === 'xl/sharedStrings.xml',
  );
  const sheetBytes = entries['xl/worksheets/sheet1.xml'];
  if (!sheetBytes) throw new Error("워크북에 'xl/worksheets/sheet1.xml' 시트가 없습니다.");
  const dec = new TextDecoder('utf-8');
  const shared = entries['xl/sharedStrings.xml']
    ? parseSharedStrings(dec.decode(entries['xl/sharedStrings.xml']))
    : [];
  return parseSheet(dec.decode(sheetBytes), shared);
}
