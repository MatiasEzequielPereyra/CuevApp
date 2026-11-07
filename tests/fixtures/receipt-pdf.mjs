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
