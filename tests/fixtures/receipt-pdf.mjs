import { deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";

export async function validPdfFixture(useObjectStreams = true) {
  const document = await PDFDocument.create();
  document.addPage().drawText("Comprobante sintetico");
  return Buffer.from(await document.save({ useObjectStreams }));
}

export function forgedXrefFixture() {
  const body = "%PDF-1.7\n1 0 obj\n<< /Type /XRef /Root 7 0 R >>\nstream\nfalso\nendstream\nendobj\n";
  const tail = "startxref\n9\n%%EOF\n";
  return Buffer.from(body + " ".repeat(128 - body.length - tail.length) + tail);
}

export function classicPdfFixture(objects, minimumBytes = 0) {
  const chunks = [Buffer.from("%PDF-1.7\n")], offsets = [];
  let size = chunks[0].length;
  for (const [index, object] of objects.entries()) {
    offsets.push(size);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), Buffer.from(object), Buffer.from("\nendobj\n")]);
    size += chunk.length;
    chunks.push(chunk);
  }
  const index = offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  const tail = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n${index}trailer\n<</Size ${offsets.length + 1}/Root 1 0 R>>\nstartxref\n${size}\n%%EOF\n`;
  return Buffer.concat([...chunks, Buffer.from(tail), Buffer.alloc(Math.max(0, minimumBytes - size - tail.length), 32)]);
}

const ref = id => `${id} 0 R`;
const catalog = "<</Type/Catalog/Pages 2 0 R>>";
const leaf = parent => `<</Type/Page/Parent ${ref(parent)}/MediaBox[0 0 100 100]>>`;

export function repeatedPageTreeFixture({ depth = 15, duplicate = true, claimedCount = 1 } = {}) {
  const objects = [catalog];
  for (let level = 0; level < depth; level++) {
    const id = level + 2, kid = ref(id + 1);
    objects.push(`<</Type/Pages/Kids[${kid}${duplicate ? ` ${kid}` : ""}]/Count ${claimedCount}${level ? `/Parent ${ref(id - 1)}` : ""}>>`);
  }
  return classicPdfFixture([...objects, leaf(depth + 1)], duplicate && depth === 15 ? 1756 : 0);
}

export function cyclicPageTreeFixture() {
  return classicPdfFixture([catalog, "<</Type/Pages/Kids[3 0 R]/Count 1>>", "<</Type/Pages/Parent 2 0 R/Kids[2 0 R]/Count 1>>"]);
}

export function manyPagesFixture(count) {
  const leaves = Array.from({ length: count }, (_, index) => ref(index + 3));
  return classicPdfFixture([catalog, `<</Type/Pages/Kids[${leaves.join(" ")}]/Count ${count}>>`, ...leaves.map(() => leaf(2))]);
}

export function extraObjectsFixture(extras) {
  return classicPdfFixture([catalog, "<</Type/Pages/Kids[3 0 R]/Count 1>>", leaf(2), ...extras]);
}

export function objectStreamFixture(size, count = 1, id = 99, body = "true") {
  const prefix = `${id} 0 `;
  const payload = Buffer.alloc(size, 32);
  payload.write(`${prefix}${body}`);
  const compressed = deflateSync(payload);
  return Buffer.concat([
    Buffer.from(`<</Type/ObjStm/N ${count}/First ${prefix.length}/Filter/FlateDecode/Length ${compressed.length}>>\nstream\n`),
    compressed, Buffer.from("\nendstream"),
  ]);
}
