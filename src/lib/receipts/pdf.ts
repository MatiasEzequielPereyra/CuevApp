import { inflateSync } from "node:zlib";
import {
  PDFArray, PDFDict, PDFName, PDFNumber, PDFObjectParser, PDFParser, PDFRawStream, PDFRef,
  type PDFContext, type PDFObject,
} from "pdf-lib";
import ByteStream from "pdf-lib/cjs/core/parser/ByteStream";

const maxObjects = 10_000;
const maxValues = 100_000;
const maxDepth = 32;
const maxPages = 100;
const maxDecodedBytes = 16 * 1024 * 1024;
const name = PDFName.of;
const field = (dict: PDFDict, key: string) => dict.get(name(key));
const number = (value: PDFObject | undefined) => value instanceof PDFNumber ? value.asNumber() : NaN;
const integer = (value: number, min: number, max: number) => Number.isSafeInteger(value) && value >= min && value <= max;

function invalidPdf(): never {
  throw new Error("Invalid or oversized PDF structure");
}

class PdfBudget {
  objects = 0;
  values = 0;
  depth = 0;
  decoded = 0;

  addObjects(count: number) {
    this.objects += count;
    if (this.objects > maxObjects) invalidPdf();
  }

  readValue(parse: () => PDFObject) {
    if (++this.values > maxValues || this.depth >= maxDepth) invalidPdf();
    this.depth++;
    try {
      return parse();
    } finally {
      this.depth--;
    }
  }

  decode(stream: PDFRawStream, limit = maxDecodedBytes) {
    const { dict } = stream;
    const length = number(field(dict, "Length"));
    const filter = field(dict, "Filter");
    const method = filter instanceof PDFArray && filter.size() === 1 ? filter.get(0) : filter;
    const remaining = Math.min(limit, maxDecodedBytes - this.decoded);
    if (length !== stream.getContentsSize() || remaining < 1 || (!method && length > remaining)) invalidPdf();
    if (method && method !== name("FlateDecode")) invalidPdf();
    const bytes = method ? inflateSync(stream.getContents(), { maxOutputLength: remaining }) : Buffer.from(stream.getContents());
    if (bytes.length > remaining) invalidPdf();
    this.decoded += bytes.length;
    return bytes;
  }
}

class CompressedObjects extends PDFObjectParser {
  constructor(bytes: Buffer, context: PDFContext, private readonly budget: PdfBudget) {
    super(ByteStream.of(bytes), context);
  }

  override parseObject() {
    return this.budget.readValue(() => super.parseObject());
  }

  assignObjects(bytes: Buffer, first: number, count: number) {
    // The header consists of one object number and byte offset per entry.
    const header = bytes.toString("latin1", 0, first).trim().split(/[\t\r\n\f ]+/);
    if (header.length !== count * 2 || header.some(value => !/^\d{1,10}$/.test(value))) invalidPdf();
    const ids = new Set<number>();
    let last = -1;
    for (let i = 0; i < header.length; i += 2) {
      const id = Number(header[i]), offset = Number(header[i + 1]);
      const next = i + 2 < header.length ? Number(header[i + 3]) : bytes.length - first;
      if (!integer(id, 1, 2_147_483_647) || ids.has(id) || offset <= last || next <= offset
        || first + next > bytes.length) invalidPdf();
      ids.add(id);
      last = offset;
      this.bytes.moveTo(first + offset);
      const object = this.parseObject();
      if (object instanceof PDFRawStream || this.bytes.offset() > first + next) invalidPdf();
      this.context.assign(PDFRef.of(id, 0), object);
    }
  }
}

// pdf-lib parses the PDF syntax. Intercept structural streams before its
// document parser can expand them with its default, unbounded decoder.
class BoundedPdfParser extends PDFParser {
  private readonly budget = new PdfBudget();
  private integers = 0;

  protected override parseRawInt() {
    // Also bounds classic xref work, including previous incremental sections.
    if (++this.integers > maxValues) invalidPdf();
    return super.parseRawInt();
  }

  override parseObject() {
    const outer = this.budget.depth === 0;
    if (outer) this.budget.addObjects(1);
    const object = this.budget.readValue(() => super.parseObject());
    if (!(object instanceof PDFRawStream)) return object;
    if (!outer) invalidPdf();
    const { dict } = object;
    // Resolve Type just as pdf-lib does, so indirect Type cannot bypass the guard.
    const type = dict.lookup(name("Type"));
    if (type === name("ObjStm")) {
      const count = number(field(dict, "N")), first = number(field(dict, "First"));
      if (!integer(count, 1, maxObjects) || !integer(first, 1, count * 32) || field(dict, "DecodeParms")) invalidPdf();
      this.budget.addObjects(count);
      const bytes = this.budget.decode(object);
      if (first >= bytes.length) invalidPdf();
      new CompressedObjects(bytes, this.context, this.budget).assignObjects(bytes, first, count);
      return dict;
    }
    if (type === name("XRef")) {
      const size = number(field(dict, "Size"));
      const widths = field(dict, "W"), index = field(dict, "Index");
      if (!integer(size, 1, 200_000) || !(widths instanceof PDFArray) || widths.size() !== 3) invalidPdf();
      let width = 0;
      for (let i = 0; i < 3; i++) {
        const part = number(widths.get(i));
        if (!integer(part, 0, 4)) invalidPdf();
        width += part;
      }
      let rows = size;
      if (index !== undefined) {
        if (!(index instanceof PDFArray) || !index.size() || index.size() % 2) invalidPdf();
        rows = 0;
        let end = 0;
        for (let i = 0; i < index.size(); i += 2) {
          const start = number(index.get(i)), count = number(index.get(i + 1));
          if (!integer(start, end, size - 1) || !integer(count, 1, size - start)) invalidPdf();
          end = start + count;
          rows += count;
        }
      }
      if (!width || rows > maxObjects + 1) invalidPdf();
      const params = field(dict, "DecodeParms");
      const options = params instanceof PDFArray && params.size() === 1 ? params.get(0) : params;
      let taggedRows = false;
      if (options !== undefined) {
        if (!(options instanceof PDFDict)) invalidPdf();
        const predictor = number(field(options, "Predictor") ?? PDFNumber.of(1));
        if (!integer(predictor, 1, 2) && !integer(predictor, 10, 15)) invalidPdf();
        taggedRows = predictor >= 10;
        if (predictor !== 1 && (number(field(options, "Columns")) !== width
          || number(field(options, "Colors") ?? PDFNumber.of(1)) !== 1
          || number(field(options, "BitsPerComponent") ?? PDFNumber.of(8)) !== 8)) invalidPdf();
      }
      const stride = width + Number(taggedRows);
      const bytes = this.budget.decode(object, rows * stride);
      if (bytes.length !== rows * stride) invalidPdf();
      if (taggedRows) {
        for (let i = 0; i < bytes.length; i += stride) if (bytes[i]! > 4) invalidPdf();
      }
      const trailer: PDFContext["trailerInfo"] = {};
      for (const key of ["Root", "Encrypt", "Info", "ID"] as const) {
        const value = field(dict, key);
        if (value) trailer[key] = value;
      }
      this.context.trailerInfo = trailer;
      return dict;
    }
    return object;
  }
}

function pdfIndexRoot(bytes: Buffer) {
  if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(bytes.toString("latin1", 0, 16))) return false;
  const tailStart = Math.max(0, bytes.length - 4096);
  const tail = /startxref[\t \r\n]+(\d{1,10})[\t \r\n]+%%EOF[\t \r\n]*$/.exec(bytes.toString("latin1", tailStart));
  if (!tail) return false;
  const offset = Number(tail[1]);
  const tailOffset = tailStart + tail.index;
  if (offset < 9 || offset >= tailOffset) return false;
  const xref = bytes.toString("latin1", offset, tailOffset);
  const rootRef = /\/Root\s+(\d{1,10})\s+(\d{1,5})\s+R\b/;

  if (/^xref\s/.test(xref)) {
    const trailer = xref.indexOf("trailer");
    const root = trailer < 0 ? null : rootRef.exec(xref.slice(trailer));
    if (!root || trailer > 512 * 1024) return false;
    const lines = xref.slice(4, trailer).trim().split(/\r\n|\r|\n/);
    let index = 0, objects = 0, entries = 0;
    while (index < lines.length) {
      const section = /^(\d{1,10})[ \t]+(\d{1,10})$/.exec(lines[index++]!.trim());
      if (!section) return false;
      const start = Number(section[1]), count = Number(section[2]);
      entries += count;
      if (count < 1 || count > lines.length - index || entries > maxObjects + 1) return false;
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
    return objects > 0 && PDFRef.of(Number(root[1]), Number(root[2]));
  }

  // PDF 1.5+ permits a cross-reference stream instead of a text table.
  const stream = />>[\t \r\n]*stream\r?\n/.exec(xref);
  if (!stream) return false;
  const dictionary = xref.slice(0, stream.index);
  const length = /\/Length\s+(\d{1,10})\b(?!\s+\d+\s+R\b)/.exec(dictionary);
  const root = rootRef.exec(dictionary);
  const size = Number(/\/Size\s+([1-9]\d{0,5})\b/.exec(dictionary)?.[1]);
  const widths = /\/W\s*\[\s*([0-4])\s+([0-4])\s+([0-4])\s*\]/.exec(dictionary);
  if (!root || !length || Number(length[1]) < 1 || !size || size > 200_000 || !widths) return false;
  if (/\/Index\b/.test(dictionary)) {
    const sections = /\/Index\s*\[\s*([\d\s]+)\]/.exec(dictionary)?.[1]?.trim().split(/\s+/).map(Number);
    if (!sections?.length || sections.length % 2) return false;
    let endObject = 0;
    for (let i = 0; i < sections.length; i += 2) {
      const start = sections[i]!, count = sections[i + 1]!;
      if (!count || start < endObject || start + count > size) return false;
      endObject = start + count;
    }
  }
  const end = stream.index + stream[0].length + Number(length[1]);
  return /^\d+\s+\d+\s+obj\s*<</.test(dictionary)
    && /\/Type\s*\/XRef\b/.test(dictionary)
    && /^[\r\n]*endstream\s+endobj\s*$/.test(xref.slice(end))
    && PDFRef.of(Number(root[1]), Number(root[2]));
}

function countPages(context: PDFContext, root: PDFRef) {
  const seen = new Set<PDFRef>();
  let pages = 0;
  function visit(ref: PDFObject | undefined, parent: PDFRef | undefined, depth: number): number {
    if (!(ref instanceof PDFRef) || depth >= maxDepth || seen.has(ref) || seen.size >= maxObjects) invalidPdf();
    seen.add(ref);
    const node = context.lookup(ref);
    if (!(node instanceof PDFDict) || (parent && field(node, "Parent") !== parent)) invalidPdf();
    const type = field(node, "Type");
    if (parent && type === name("Page")) {
      if (++pages > maxPages) invalidPdf();
      return 1;
    }
    if (type !== name("Pages")) invalidPdf();
    const kids = node.lookup(name("Kids")), expected = number(field(node, "Count"));
    if (!(kids instanceof PDFArray) || !integer(expected, 0, maxPages) || kids.size() > maxObjects - seen.size) invalidPdf();
    let count = 0;
    for (let i = 0; i < kids.size(); i++) {
      count += visit(kids.get(i), ref, depth + 1);
      if (count > expected) invalidPdf();
    }
    if (count !== expected) invalidPdf();
    return count;
  }
  return visit(root, undefined, 0);
}

export async function validPdf(bytes: Buffer) {
  const root = pdfIndexRoot(bytes);
  if (!root) return false;
  const context = await new BoundedPdfParser(bytes, 250, true).parseDocument();
  if (context.trailerInfo.Encrypt || context.trailerInfo.Root !== root) return false;
  const catalog = context.lookup(root);
  if (!(catalog instanceof PDFDict) || field(catalog, "Type") !== name("Catalog")) return false;
  const pages = field(catalog, "Pages");
  return pages instanceof PDFRef && countPages(context, pages) > 0;
}
