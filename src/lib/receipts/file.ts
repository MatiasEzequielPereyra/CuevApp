import { crc32, inflateSync } from "node:zlib";

function validPng(bytes: Buffer) {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  const compressed: Buffer[] = [];
  let width = 0, height = 0, channels = 0, depth = 0, interlace = 0, indexed = false, palette = false;
  let offset = 8, dataEnded = false, complete = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > bytes.length) return false;
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, end - 4);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) return false;
    if (offset === 8) {
      if (type !== "IHDR" || length !== 13) return false;
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]!; interlace = data[12]!;
      const color = data[9]!;
      channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color] ?? 0;
      indexed = color === 3;
      const depths = color === 0 ? [1, 2, 4, 8, 16] : indexed ? [1, 2, 4, 8] : [8, 16];
      if (!width || !height || !channels || !depths.includes(depth) || data[10] || data[11] || interlace > 1) return false;
    } else if (type === "IDAT") {
      if (dataEnded || (indexed && !palette)) return false;
      compressed.push(data);
    } else {
      if (compressed.length) dataEnded = true;
      if (type === "PLTE") {
        if (palette || dataEnded || length < 3 || length > 768 || length % 3) return false;
        palette = true;
      } else if (type === "IEND") {
        complete = length === 0 && end === bytes.length;
        break;
      } else if (!/^[a-z][A-Za-z]{3}$/.test(type)) return false;
    }
    offset = end;
  }
  if (!complete || !compressed.length) return false;

  // Validate the zlib stream and scanline lengths, bounding decoded memory.
  const passes = interlace ? [[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]] : [[0,0,1,1]];
  const rows = passes.map(([x,y,dx,dy]) => {
    const w = Math.ceil((width - x!) / dx!), h = Math.ceil((height - y!) / dy!);
    return w > 0 && h > 0 ? { count: h, bytes: Math.ceil(w * channels * depth / 8) + 1 } : { count: 0, bytes: 0 };
  });
  const expected = rows.reduce((sum, row) => sum + row.count * row.bytes, 0);
  if (expected < 1 || expected > 64 * 1024 * 1024) return false;
  const pixels = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
  if (pixels.length !== expected) return false;
  offset = 0;
  for (const row of rows) {
    for (let i = 0; i < row.count; i++, offset += row.bytes) {
      if (pixels[offset]! > 4) return false;
    }
  }
  return true;
}

function validJpeg(bytes: Buffer) {
  if (bytes.length < 12 || bytes.readUInt16BE(0) !== 0xffd8) return false;
  let offset = 2, frame = false, scan = false, scanning = false;
  while (offset < bytes.length) {
    if (scanning) {
      offset = bytes.indexOf(0xff, offset);
      if (offset === -1) return false;
    }
    if (bytes[offset++] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (scanning && (marker === 0 || (marker !== undefined && marker >= 0xd0 && marker <= 0xd7))) continue;
    scanning = false;
    if (marker === 0xd9) return frame && scan && offset === bytes.length;
    if (marker === undefined || marker < 0xc0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || offset + 2 > bytes.length) return false;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return false;
    if (marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (length < 8 || !bytes.readUInt16BE(offset + 3) || !bytes.readUInt16BE(offset + 5)) return false;
      frame = true;
    }
    if (marker === 0xda) {
      if (!frame || length < 6) return false;
      scan = true;
      scanning = true;
    }
    offset += length;
  }
  return false;
}

function validPdf(bytes: Buffer) {
  if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(bytes.toString("latin1", 0, 16))) return false;
  const tailStart = Math.max(0, bytes.length - 4096);
  const tail = /startxref[\t \r\n]+(\d{1,10})[\t \r\n]+%%EOF[\t \r\n]*$/.exec(bytes.toString("latin1", tailStart));
  if (!tail) return false;
  const offset = Number(tail[1]);
  const tailOffset = tailStart + tail.index;
  if (offset < 9 || offset >= tailOffset) return false;
  const xref = bytes.toString("latin1", offset, tailOffset);

  if (/^xref\s/.test(xref)) {
    const trailer = xref.indexOf("trailer");
    if (trailer < 0 || !/\/Root\s+\d+\s+\d+\s+R\b/.test(xref.slice(trailer))) return false;
    const lines = xref.slice(4, trailer).trim().split(/\r\n|\r|\n/);
    let index = 0, objects = 0;
    while (index < lines.length) {
      const section = /^(\d{1,10})[ \t]+(\d{1,10})$/.exec(lines[index++]!.trim());
      if (!section) return false;
      const start = Number(section[1]), count = Number(section[2]);
      if (count < 1 || count > lines.length - index) return false;
      for (let entry = 0; entry < count; entry++) {
        const fields = /^(\d{10})[ \t]+(\d{5})[ \t]+([nf])$/.exec(lines[index++]!.trim());
        if (!fields) return false;
        if (fields[3] === "f") continue;
        const position = Number(fields[1]);
        if (position < 9 || position >= offset) return false;
        const object = /^(\d+)[ \t\r\n]+(\d+)[ \t\r\n]+obj\b/.exec(bytes.toString("latin1", position, position + 64));
        if (!object || Number(object[1]) !== start + entry || Number(object[2]) !== Number(fields[2])) return false;
        objects++;
      }
    }
    return objects > 0;
  }

  // PDF 1.5+ permits a cross-reference stream instead of a text table.
  const stream = xref.indexOf("stream");
  const end = xref.lastIndexOf("endstream");
  if (stream < 0 || end <= stream + 6) return false;
  const dictionary = xref.slice(0, stream);
  return /^\d+\s+\d+\s+obj\s*<</.test(dictionary)
    && /\/Type\s*\/XRef\b/.test(dictionary)
    && /\/Root\s+\d+\s+\d+\s+R\b/.test(dictionary)
    && /^endstream\s+endobj\s*$/.test(xref.slice(end));
}

export function validReceiptBytes(bytes: Buffer, mediaType: string): boolean {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) return false;
  try {
    if (mediaType === "image/png") return validPng(bytes);
    if (mediaType === "image/jpeg") return validJpeg(bytes);
    if (mediaType === "application/pdf") return validPdf(bytes);
    return false;
  } catch {
    return false;
  }
}
