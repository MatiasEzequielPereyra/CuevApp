import { crc32, inflateSync } from "node:zlib";
import sharp from "sharp";
import { validPdf } from "./pdf";

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

async function validJpeg(bytes: Buffer) {
  if (bytes.length < 12 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) return false;
  const image = sharp(bytes, { failOn: "warning", limitInputPixels: 50_000_000 });
  if ((await image.metadata()).format !== "jpeg") return false;
  // Pixel statistics force a decode. Header metadata alone misses corrupt scans.
  await image.stats();
  return true;
}

export async function validReceiptBytes(bytes: Buffer, mediaType: string): Promise<boolean> {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) return false;
  try {
    if (mediaType === "image/png") return validPng(bytes);
    if (mediaType === "image/jpeg") return await validJpeg(bytes);
    if (mediaType === "application/pdf") return await validPdf(bytes);
    return false;
  } catch {
    return false;
  }
}
